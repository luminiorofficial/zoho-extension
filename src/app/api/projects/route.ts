import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isDate, isUuid } from '@/lib/planner-validation';

interface ProjectPayload {
  departmentId?: unknown;
  goalId?: unknown;
  clientName?: unknown;
  name?: unknown;
  jobCode?: unknown;
  description?: unknown;
  ownerId?: unknown;
  memberIds?: unknown;
  startDate?: unknown;
  deadline?: unknown;
  status?: unknown;
  budget?: unknown;
}

const statuses = new Set([
  'PLANNED',
  'ACTIVE',
  'INTERNAL_REVIEW',
  'CLIENT_REVIEW',
  'DELIVERED',
  'CLOSURE_PENDING',
]);

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function memberIds(value: unknown, ownerId: string): string[] | null {
  if (!Array.isArray(value) || value.some((id) => !isUuid(id))) return null;
  return [...new Set([ownerId, ...value])];
}

export async function POST(request: Request) {
  let payload: ProjectPayload;

  try {
    payload = await request.json() as ProjectPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const clientName = textValue(payload.clientName);
  const name = textValue(payload.name);
  const jobCode = textValue(payload.jobCode);
  const description = textValue(payload.description);
  const status = textValue(payload.status) || 'PLANNED';
  const budget = typeof payload.budget === 'number'
    ? payload.budget
    : Number(textValue(payload.budget));

  if (
    !isUuid(payload.departmentId)
    || !isUuid(payload.goalId)
    || !isUuid(payload.ownerId)
    || !clientName
    || !name
    || !jobCode
    || !isDate(payload.startDate)
    || !isDate(payload.deadline)
    || payload.deadline < payload.startDate
    || !statuses.has(status)
    || !Number.isFinite(budget)
    || budget < 0
  ) {
    return Response.json(
      { error: 'Complete all project fields with valid dates, status, and budget.' },
      { status: 400 },
    );
  }

  const assignedMemberIds = memberIds(payload.memberIds, payload.ownerId);
  if (!assignedMemberIds?.length) {
    return Response.json({ error: 'Select at least one assigned member.' }, { status: 400 });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const hierarchyResult = await client.query<{ goal_exists: boolean; member_count: number }>(
      `SELECT
         EXISTS (
           SELECT 1 FROM goals
            WHERE id = $2 AND department_id = $1 AND is_active
              AND EXISTS (SELECT 1 FROM departments WHERE id = $1 AND is_active)
         ) AS goal_exists,
         (
           SELECT COUNT(*)::integer
             FROM department_members dm
             JOIN members m ON m.id = dm.member_id AND m.is_active
            WHERE dm.department_id = $1
              AND dm.member_id = ANY($3::uuid[])
         ) AS member_count`,
      [payload.departmentId, payload.goalId, assignedMemberIds],
    );

    const hierarchy = hierarchyResult.rows[0];
    if (!hierarchy.goal_exists || hierarchy.member_count !== assignedMemberIds.length) {
      await client.query('ROLLBACK');
      return Response.json(
        { error: 'The goal, owner, and assigned members must belong to the selected department.' },
        { status: 400 },
      );
    }

    const result = await client.query<{ id: string }>(
      `INSERT INTO projects (
         department_id, goal_id, client_name, name, code, description,
         owner_member_id, start_date, end_date, status, budget
       ) VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        payload.departmentId,
        payload.goalId,
        clientName,
        name,
        jobCode,
        description,
        payload.ownerId,
        payload.startDate,
        payload.deadline,
        status,
        budget,
      ],
    );

    const projectId = result.rows[0].id;
    await client.query(
      `INSERT INTO project_keys (project_id, key_goal_id)
       SELECT $1, g.id
       FROM goals g
       WHERE g.department_id = $2
         AND g.is_active
         AND UPPER(BTRIM(g.code)) IN ('KEY_A', 'KEY_B', 'KEY_C')
       ON CONFLICT DO NOTHING`,
      [projectId, payload.departmentId],
    );
    await client.query(
      `INSERT INTO project_members (project_id, member_id)
       SELECT $1, UNNEST($2::uuid[])`,
      [projectId, assignedMemberIds],
    );
    await client.query('COMMIT');

    revalidatePath('/projects');
    revalidatePath('/workload');
    revalidatePath(`/departments/${payload.departmentId}`);
    revalidatePath('/departments');

    return Response.json({ project: { id: projectId } }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK');
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      return Response.json(
        { error: 'A project with this name already exists in the department.' },
        { status: 409 },
      );
    }
    console.error('Could not create project:', error);
    return Response.json({ error: 'Could not create the project.' }, { status: 500 });
  } finally {
    client.release();
  }
}
