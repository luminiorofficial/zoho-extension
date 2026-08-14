import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isOptionalDate, isUuid, textValue, uuidArray } from '@/lib/planner-validation';

interface ActionPatchPayload {
  code?: unknown;
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  status?: unknown;
  startDate?: unknown;
  dueDate?: unknown;
  assignedMemberIds?: unknown;
  isActive?: unknown;
}

const statuses = new Set(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'ON_HOLD', 'CANCELLED']);
const priorities = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

function refreshAction(departmentId: string, memberIds: string[]) {
  revalidatePath(`/departments/${departmentId}`);
  revalidatePath('/departments');
  revalidatePath('/members');
  revalidatePath('/projects');
  revalidatePath('/workload');
  revalidatePath('/dashboard');
  for (const memberId of memberIds) revalidatePath(`/members/${memberId}`);
}

export async function PATCH(request: Request, context: RouteContext<'/api/actions/[id]'>) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: 'Invalid action id.' }, { status: 400 });
  let payload: ActionPatchPayload;
  try {
    payload = await request.json() as ActionPatchPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  let assignedMemberIds: string[] | undefined;
  if ('assignedMemberIds' in payload) {
    const parsed = uuidArray(payload.assignedMemberIds);
    if (!parsed?.length) return Response.json({ error: 'Select at least one assignee.' }, { status: 400 });
    assignedMemberIds = parsed;
  }

  const changes: string[] = [];
  const values: unknown[] = [id];
  const add = (column: string, value: unknown, cast = '') => {
    values.push(value);
    changes.push(`${column} = $${values.length}${cast}`);
  };
  if ('code' in payload) {
    const value = textValue(payload.code, 100);
    if (value === null) return Response.json({ error: 'Action code is too long.' }, { status: 400 });
    add('code', value || null);
  }
  if ('title' in payload) {
    const value = textValue(payload.title);
    if (!value) return Response.json({ error: 'Action title is required.' }, { status: 400 });
    add('title', value);
  }
  if ('description' in payload) {
    const value = textValue(payload.description);
    if (value === null) return Response.json({ error: 'Invalid action description.' }, { status: 400 });
    add('description', value || null);
  }
  if ('priority' in payload) {
    const value = textValue(payload.priority, 20);
    if (value === null || (value && !priorities.has(value))) return Response.json({ error: 'Invalid action priority.' }, { status: 400 });
    add('priority', value || null);
  }
  if ('status' in payload) {
    const value = textValue(payload.status, 30);
    if (!value || !statuses.has(value)) return Response.json({ error: 'Invalid action status.' }, { status: 400 });
    add('status', value);
  }
  if ('isActive' in payload) {
    if (typeof payload.isActive !== 'boolean') return Response.json({ error: 'Invalid active status.' }, { status: 400 });
    add('is_active', payload.isActive);
  }
  if ('startDate' in payload) {
    if (!isOptionalDate(payload.startDate)) return Response.json({ error: 'Invalid start date.' }, { status: 400 });
    add('start_date', payload.startDate || null, '::date');
  }
  if ('dueDate' in payload) {
    if (!isOptionalDate(payload.dueDate)) return Response.json({ error: 'Invalid due date.' }, { status: 400 });
    add('due_date', payload.dueDate || null, '::date');
  }
  if (!changes.length && assignedMemberIds === undefined) {
    return Response.json({ error: 'No supported action changes were provided.' }, { status: 400 });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const currentResult = await client.query<{
      goal_id: string;
      department_id: string;
      start_date: string | null;
      due_date: string | null;
    }>(
      `SELECT a.goal_id, g.department_id, a.start_date::text, a.due_date::text
         FROM actions a JOIN goals g ON g.id = a.goal_id
        WHERE a.id = $1 FOR UPDATE OF a`,
      [id],
    );
    const current = currentResult.rows[0];
    if (!current) {
      await client.query('ROLLBACK');
      return Response.json({ error: 'Action not found.' }, { status: 404 });
    }
    const currentAssignees = await client.query<{ member_id: string }>(
      `SELECT member_id FROM action_assignees WHERE action_id = $1`,
      [id],
    );
    const currentMemberIds = currentAssignees.rows.map((row) => row.member_id);

    const startDate = 'startDate' in payload ? payload.startDate || null : current.start_date;
    const dueDate = 'dueDate' in payload ? payload.dueDate || null : current.due_date;
    if (typeof startDate === 'string' && typeof dueDate === 'string' && dueDate < startDate) {
      await client.query('ROLLBACK');
      return Response.json({ error: 'Action due date cannot be before its start date.' }, { status: 400 });
    }

    if (payload.isActive === true) {
      const activeParent = await client.query(
        `SELECT 1 FROM goals g JOIN departments d ON d.id = g.department_id
          WHERE g.id = $1 AND g.is_active AND d.is_active`,
        [current.goal_id],
      );
      if (!activeParent.rows[0]) {
        await client.query('ROLLBACK');
        return Response.json({ error: 'Reactivate the goal and department first.' }, { status: 409 });
      }
    }

    if (assignedMemberIds) {
      const members = await client.query<{ count: number }>(
        `SELECT COUNT(*)::integer AS count
           FROM department_members dm JOIN members m ON m.id = dm.member_id
          WHERE dm.department_id = $1
            AND dm.member_id = ANY($2::uuid[])
            AND (m.is_active OR dm.member_id = ANY($3::uuid[]))`,
        [current.department_id, assignedMemberIds, currentMemberIds],
      );
      if (members.rows[0].count !== assignedMemberIds.length) {
        await client.query('ROLLBACK');
        return Response.json({ error: 'All assignees must be active members of the goal department.' }, { status: 400 });
      }
      const removed = currentMemberIds.filter((memberId) => !assignedMemberIds!.includes(memberId));
      if (removed.length) {
        const linked = await client.query(
          `SELECT 1 FROM week_goals
            WHERE action_id = $1 AND assigned_member_id = ANY($2::uuid[]) LIMIT 1`,
          [id, removed],
        );
        if (linked.rows[0]) {
          await client.query('ROLLBACK');
          return Response.json(
            { error: 'An assignee with weekly goals cannot be removed. Deactivate the action instead.' },
            { status: 409 },
          );
        }
      }
    }

    if ('title' in payload) {
      const duplicate = await client.query(
        `SELECT 1 FROM actions WHERE goal_id = $1 AND LOWER(title) = LOWER($2) AND id <> $3 LIMIT 1`,
        [current.goal_id, textValue(payload.title), id],
      );
      if (duplicate.rows[0]) {
        await client.query('ROLLBACK');
        return Response.json({ error: 'An action with this title already exists.' }, { status: 409 });
      }
    }

    if (changes.length) await client.query(`UPDATE actions SET ${changes.join(', ')} WHERE id = $1`, values);
    if (assignedMemberIds) {
      await client.query(
        `DELETE FROM action_assignees
          WHERE action_id = $1 AND NOT (member_id = ANY($2::uuid[]))`,
        [id, assignedMemberIds],
      );
      await client.query(
        `INSERT INTO action_assignees (action_id, member_id)
         SELECT $1, UNNEST($2::uuid[])
         ON CONFLICT (action_id, member_id) DO NOTHING`,
        [id, assignedMemberIds],
      );
    }
    await client.query('COMMIT');
    refreshAction(current.department_id, [...new Set([...currentMemberIds, ...(assignedMemberIds ?? [])])]);
    return Response.json({ action: { id } });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Could not update action:', error);
    return Response.json({ error: 'Could not update the action.' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(_request: Request, context: RouteContext<'/api/actions/[id]'>) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: 'Invalid action id.' }, { status: 400 });
  try {
    const result = await db.query<{ department_id: string; member_ids: string[] }>(
      `WITH updated AS (
         UPDATE actions SET is_active = FALSE WHERE id = $1 RETURNING id, goal_id
       )
       SELECT g.department_id,
              COALESCE(ARRAY_AGG(aa.member_id) FILTER (WHERE aa.member_id IS NOT NULL), '{}') AS member_ids
         FROM updated u JOIN goals g ON g.id = u.goal_id
         LEFT JOIN action_assignees aa ON aa.action_id = u.id
        GROUP BY g.department_id`,
      [id],
    );
    if (!result.rows[0]) return Response.json({ error: 'Action not found.' }, { status: 404 });
    refreshAction(result.rows[0].department_id, result.rows[0].member_ids);
    return Response.json({ action: { id, isActive: false } });
  } catch (error) {
    console.error('Could not deactivate action:', error);
    return Response.json({ error: 'Could not deactivate the action.' }, { status: 500 });
  }
}
