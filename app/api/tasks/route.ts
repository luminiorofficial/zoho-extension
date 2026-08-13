import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';

interface TaskPayload {
  memberId?: unknown;
  projectId?: unknown;
  actionId?: unknown;
  weekGoalTitle?: unknown;
  title?: unknown;
  description?: unknown;
  taskDate?: unknown;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isoWeekStart(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  let payload: TaskPayload;

  try {
    payload = await request.json() as TaskPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const description = typeof payload.description === 'string'
    ? payload.description.trim()
    : '';
  const weekGoalTitle = typeof payload.weekGoalTitle === 'string'
    ? payload.weekGoalTitle.trim()
    : '';

  if (
    !isUuid(payload.memberId)
    || !isUuid(payload.projectId)
    || !isUuid(payload.actionId)
    || !isDate(payload.taskDate)
    || !title
    || !weekGoalTitle
  ) {
    return Response.json(
      { error: 'Member, project, action, week goal, task date, and task title are required.' },
      { status: 400 },
    );
  }

  const weekStart = isoWeekStart(payload.taskDate);
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const hierarchyResult = await client.query(
      `SELECT a.goal_id, p.department_id
         FROM actions a
         JOIN action_assignees aa
           ON aa.action_id = a.id
          AND aa.member_id = $3
         JOIN projects p
           ON p.id = $2
          AND p.goal_id = a.goal_id
         JOIN department_members dm
           ON dm.department_id = p.department_id
          AND dm.member_id = $3
        WHERE a.id = $1`,
      [payload.actionId, payload.projectId, payload.memberId],
    );

    const hierarchy = hierarchyResult.rows[0];
    if (!hierarchy) {
      await client.query('ROLLBACK');
      return Response.json(
        { error: 'The selected action, project, and member are not in the same goal flow.' },
        { status: 400 },
      );
    }

    const weekPlanResult = await client.query(
      `INSERT INTO week_plans (department_id, member_id, week_start)
       VALUES ($1, $2, $3)
       ON CONFLICT (department_id, member_id, week_start)
       DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [hierarchy.department_id, payload.memberId, weekStart],
    );

    const weekPlanId = weekPlanResult.rows[0].id;
    const weekGoalResult = await client.query(
      `INSERT INTO week_goals (
         week_plan_id,
         department_id,
         assigned_member_id,
         goal_id,
         action_id,
         project_id,
         week_start,
         title
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (week_plan_id, action_id, project_id, title)
       DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [
        weekPlanId,
        hierarchy.department_id,
        payload.memberId,
        hierarchy.goal_id,
        payload.actionId,
        payload.projectId,
        weekStart,
        weekGoalTitle,
      ],
    );

    const taskResult = await client.query(
      `INSERT INTO tasks (
         week_goal_id,
         action_id,
         project_id,
         assigned_member_id,
         week_start,
         title,
         description,
         task_date
       ) VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), $8)
       RETURNING id`,
      [
        weekGoalResult.rows[0].id,
        payload.actionId,
        payload.projectId,
        payload.memberId,
        weekStart,
        title,
        description,
        payload.taskDate,
      ],
    );

    const createdTask = await client.query(
      `SELECT t.id,
              t.week_goal_id AS "weekGoalId",
              wg.title AS "weekGoalTitle",
              t.action_id AS "actionId",
              a.title AS "actionTitle",
              t.project_id AS "projectId",
              p.name AS "projectName",
              t.assigned_member_id AS "assignedMemberId",
              t.task_date::text AS "taskDate",
              t.title,
              t.description,
              CASE t.status
                WHEN 'DONE' THEN 'Done'
                WHEN 'IN_PROGRESS' THEN 'In Progress'
                ELSE 'Not Started'
              END AS status
         FROM tasks t
         JOIN week_goals wg ON wg.id = t.week_goal_id
         JOIN actions a ON a.id = t.action_id
         JOIN projects p ON p.id = t.project_id
        WHERE t.id = $1`,
      [taskResult.rows[0].id],
    );

    await client.query('COMMIT');

    revalidatePath(`/members/${payload.memberId}`);
    revalidatePath(`/departments/${hierarchy.department_id}`);
    revalidatePath('/dashboard');

    return Response.json({ task: createdTask.rows[0] }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Could not create task:', error);
    return Response.json({ error: 'Could not create the daily task.' }, { status: 500 });
  } finally {
    client.release();
  }
}
