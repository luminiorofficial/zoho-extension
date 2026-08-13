import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isDate, isoWeekStart, isUuid } from '@/lib/planner-validation';

interface WeekGoalPayload {
  memberId?: unknown;
  projectId?: unknown;
  actionId?: unknown;
  weekStart?: unknown;
  title?: unknown;
  description?: unknown;
}

export async function POST(request: Request) {
  let payload: WeekGoalPayload;

  try {
    payload = await request.json() as WeekGoalPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const description = typeof payload.description === 'string'
    ? payload.description.trim()
    : '';

  if (
    !isUuid(payload.memberId)
    || !isUuid(payload.projectId)
    || !isUuid(payload.actionId)
    || !isDate(payload.weekStart)
    || !title
  ) {
    return Response.json(
      { error: 'Member, project, action, week, and goal title are required.' },
      { status: 400 },
    );
  }

  const weekStart = isoWeekStart(payload.weekStart);
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

    const weekGoalResult = await client.query(
      `INSERT INTO week_goals (
         week_plan_id,
         department_id,
         assigned_member_id,
         goal_id,
         action_id,
         project_id,
         week_start,
         title,
         description
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, ''))
       RETURNING id`,
      [
        weekPlanResult.rows[0].id,
        hierarchy.department_id,
        payload.memberId,
        hierarchy.goal_id,
        payload.actionId,
        payload.projectId,
        weekStart,
        title,
        description,
      ],
    );

    await client.query('COMMIT');

    revalidatePath(`/members/${payload.memberId}`);
    revalidatePath(`/departments/${hierarchy.department_id}`);

    return Response.json({ weekGoal: { id: weekGoalResult.rows[0].id } }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK');

    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      return Response.json(
        { error: 'This weekly goal already exists for the selected week.' },
        { status: 409 },
      );
    }

    console.error('Could not create weekly goal:', error);
    return Response.json({ error: 'Could not create the weekly goal.' }, { status: 500 });
  } finally {
    client.release();
  }
}
