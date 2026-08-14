import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isOptionalDate, isUuid, textValue, uuidArray } from '@/lib/planner-validation';

interface ActionPayload {
  goalId?: unknown;
  code?: unknown;
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  status?: unknown;
  startDate?: unknown;
  dueDate?: unknown;
  assignedMemberIds?: unknown;
}

const statuses = new Set(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'ON_HOLD', 'CANCELLED']);
const priorities = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export async function POST(request: Request) {
  let payload: ActionPayload;
  try {
    payload = await request.json() as ActionPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const code = textValue(payload.code, 100);
  const title = textValue(payload.title);
  const description = textValue(payload.description);
  const priority = textValue(payload.priority, 20);
  const status = textValue(payload.status, 30) || 'NOT_STARTED';
  const assignedMemberIds = uuidArray(payload.assignedMemberIds);
  if (
    !isUuid(payload.goalId) || code === null || !title || description === null
    || priority === null || (priority && !priorities.has(priority)) || !statuses.has(status)
    || !assignedMemberIds?.length || !isOptionalDate(payload.startDate) || !isOptionalDate(payload.dueDate)
  ) {
    return Response.json(
      { error: 'Goal, title, at least one assignee, valid status, priority, and dates are required.' },
      { status: 400 },
    );
  }
  const startDate = payload.startDate || null;
  const dueDate = payload.dueDate || null;
  if (typeof startDate === 'string' && typeof dueDate === 'string' && dueDate < startDate) {
    return Response.json({ error: 'Action due date cannot be before its start date.' }, { status: 400 });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const hierarchy = await client.query<{ department_id: string; member_count: number }>(
      `SELECT g.department_id,
              (SELECT COUNT(*)::integer
                 FROM department_members dm
                 JOIN members m ON m.id = dm.member_id
                WHERE dm.department_id = g.department_id
                  AND dm.member_id = ANY($2::uuid[])
                  AND m.is_active) AS member_count
         FROM goals g JOIN departments d ON d.id = g.department_id
        WHERE g.id = $1 AND g.is_active AND d.is_active`,
      [payload.goalId, assignedMemberIds],
    );
    if (!hierarchy.rows[0] || hierarchy.rows[0].member_count !== assignedMemberIds.length) {
      await client.query('ROLLBACK');
      return Response.json({ error: 'All assignees must be active members of the goal department.' }, { status: 400 });
    }
    const duplicate = await client.query(
      `SELECT 1 FROM actions WHERE goal_id = $1 AND LOWER(title) = LOWER($2) LIMIT 1`,
      [payload.goalId, title],
    );
    if (duplicate.rows[0]) {
      await client.query('ROLLBACK');
      return Response.json({ error: 'An action with this title already exists for the goal.' }, { status: 409 });
    }

    const result = await client.query<{ id: string }>(
      `INSERT INTO actions (
         goal_id, code, title, description, priority, status, start_date, due_date
       ) VALUES ($1, NULLIF($2, ''), $3, NULLIF($4, ''), NULLIF($5, ''), $6, $7::date, $8::date)
       RETURNING id`,
      [payload.goalId, code, title, description, priority, status, startDate, dueDate],
    );
    const actionId = result.rows[0].id;
    await client.query(
      `INSERT INTO action_assignees (action_id, member_id)
       SELECT $1, UNNEST($2::uuid[])`,
      [actionId, assignedMemberIds],
    );
    await client.query('COMMIT');
    revalidatePath(`/departments/${hierarchy.rows[0].department_id}`);
    revalidatePath('/departments');
    revalidatePath('/members');
    for (const memberId of assignedMemberIds) revalidatePath(`/members/${memberId}`);
    return Response.json({ action: { id: actionId } }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Could not create action:', error);
    return Response.json({ error: 'Could not create the action.' }, { status: 500 });
  } finally {
    client.release();
  }
}
