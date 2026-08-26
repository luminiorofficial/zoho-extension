import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import {
  addDays,
  isDate,
  isoWeekStart,
  isUuid,
  textValue,
} from '@/lib/planner-validation';

interface TaskPayload {
  memberId?: unknown;
  weekGoalId?: unknown;
  title?: unknown;
  description?: unknown;
  taskDate?: unknown;
}

interface CarryForwardPayload {
  memberId?: unknown;
  sourceWeekStart?: unknown;
}

export async function POST(request: Request) {
  let payload: TaskPayload;

  try {
    payload = await request.json() as TaskPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const title = textValue(payload.title, 500);
  const description = payload.description === undefined
    ? ''
    : textValue(payload.description, 5000);

  if (
    !isUuid(payload.memberId)
    || !isUuid(payload.weekGoalId)
    || !isDate(payload.taskDate)
    || !title
    || description === null
  ) {
    return Response.json(
      { error: 'Member, weekly goal, task date, and task title are required.' },
      { status: 400 },
    );
  }

  try {
    const taskResult = await db.query(
      `WITH inserted AS (
         INSERT INTO tasks (
           week_goal_id,
           action_id,
           project_id,
           assigned_member_id,
           week_start,
           title,
           description,
           task_date
         )
         SELECT
           wg.id,
           wg.action_id,
           wg.project_id,
           wg.assigned_member_id,
           wg.week_start,
           $3,
           NULLIF($4, ''),
           $5
         FROM week_goals wg
         JOIN departments d ON d.id = wg.department_id AND d.is_active
         JOIN members m ON m.id = wg.assigned_member_id AND m.is_active
         JOIN goals g ON g.id = wg.goal_id AND g.is_active
         JOIN actions active_action ON active_action.id = wg.action_id AND active_action.is_active
         JOIN action_assignees aa
           ON aa.action_id = wg.action_id
          AND aa.member_id = wg.assigned_member_id
         JOIN projects active_project
           ON active_project.id = wg.project_id
          AND active_project.status IN ('PLANNED', 'ACTIVE', 'INTERNAL_REVIEW', 'CLIENT_REVIEW')
         JOIN project_members pm
           ON pm.project_id = wg.project_id
          AND pm.member_id = wg.assigned_member_id
         WHERE wg.id = $1
           AND wg.assigned_member_id = $2
           AND $5::date BETWEEN wg.week_start AND wg.week_start + 4
         RETURNING *
       )
       SELECT t.id,
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
                WHEN 'STARTED' THEN 'Started'
                ELSE 'Not Started'
              END AS status,
              wg.department_id AS "departmentId"
         FROM inserted t
         JOIN week_goals wg ON wg.id = t.week_goal_id
         JOIN actions a ON a.id = t.action_id
         JOIN projects p ON p.id = t.project_id`,
      [payload.weekGoalId, payload.memberId, title, description, payload.taskDate],
    );

    if (!taskResult.rows[0]) {
      return Response.json(
        { error: 'The task must use an active weekly goal and a Monday–Friday date.' },
        { status: 400 },
      );
    }

    const task = taskResult.rows[0];
    revalidatePath(`/members/${payload.memberId}`);
    revalidatePath(`/departments/${task.departmentId}`);
    revalidatePath(`/projects/${task.projectId}`);
    revalidatePath('/projects');
    revalidatePath('/workload');
    revalidatePath('/dashboard');

    return Response.json({ task: { ...task, actions: [] } }, { status: 201 });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23514') {
      return Response.json(
        { error: 'Daily tasks require an active Monday–Friday weekly-goal assignment.' },
        { status: 400 },
      );
    }
    console.error('Could not create task:', error);
    return Response.json({ error: 'Could not create the daily task.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  let payload: CarryForwardPayload;
  try {
    payload = await request.json() as CarryForwardPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!isUuid(payload.memberId) || !isDate(payload.sourceWeekStart)) {
    return Response.json(
      { error: 'Member and source week are required for carry-forward.' },
      { status: 400 },
    );
  }

  const sourceWeekStart = isoWeekStart(payload.sourceWeekStart);
  if (sourceWeekStart !== payload.sourceWeekStart) {
    return Response.json({ error: 'Source week must start on Monday.' }, { status: 400 });
  }

  const targetWeekStart = addDays(sourceWeekStart, 7);
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const currentWeekResult = await client.query<{ week_start: string }>(
      `SELECT DATE_TRUNC('week', CURRENT_DATE)::date::text AS week_start`,
    );
    if (targetWeekStart !== currentWeekResult.rows[0].week_start) {
      await client.query('ROLLBACK');
      return Response.json(
        { error: 'Only unfinished tasks from last week can be carried into the current week.' },
        { status: 400 },
      );
    }

    const sourceResult = await client.query<{
      id: string;
      title: string;
      description: string | null;
      task_date: string;
      department_id: string;
      goal_id: string;
      action_id: string;
      project_id: string;
      week_goal_title: string;
      week_goal_description: string | null;
      is_eligible: boolean;
    }>(
      `SELECT t.id,
              t.title,
              t.description,
              t.task_date::text,
              wg.department_id,
              wg.goal_id,
              wg.action_id,
              wg.project_id,
              wg.title AS week_goal_title,
              wg.description AS week_goal_description,
              (
                d.is_active
                AND m.is_active
                AND g.is_active
                AND a.is_active
                AND p.status IN ('PLANNED', 'ACTIVE', 'INTERNAL_REVIEW', 'CLIENT_REVIEW')
                AND aa.member_id IS NOT NULL
                AND pm.member_id IS NOT NULL
              ) AS is_eligible
         FROM tasks t
         JOIN week_goals wg ON wg.id = t.week_goal_id
         JOIN departments d ON d.id = wg.department_id
         JOIN members m ON m.id = wg.assigned_member_id
         JOIN goals g ON g.id = wg.goal_id
         JOIN actions a ON a.id = wg.action_id
         JOIN projects p ON p.id = wg.project_id
         LEFT JOIN action_assignees aa
           ON aa.action_id = wg.action_id AND aa.member_id = wg.assigned_member_id
         LEFT JOIN project_members pm
           ON pm.project_id = wg.project_id AND pm.member_id = wg.assigned_member_id
        WHERE t.assigned_member_id = $1
          AND t.week_start = $2
          AND t.status <> 'DONE'
          AND NOT EXISTS (
            SELECT 1 FROM tasks carried WHERE carried.carried_from_task_id = t.id
          )
        ORDER BY wg.created_at, t.task_date, t.created_at`,
      [payload.memberId, sourceWeekStart],
    );

    const eligibleTasks = sourceResult.rows.filter((task) => task.is_eligible);
    let carriedTaskCount = 0;
    const departmentIds = new Set<string>();
    const projectIds = new Set<string>();
    const targetGoalIds = new Map<string, string>();

    for (const task of eligibleTasks) {
      departmentIds.add(task.department_id);
      projectIds.add(task.project_id);

      const planResult = await client.query<{ id: string }>(
        `INSERT INTO week_plans (department_id, member_id, week_start)
         VALUES ($1, $2, $3)
         ON CONFLICT (department_id, member_id, week_start)
         DO UPDATE SET updated_at = NOW()
         RETURNING id`,
        [task.department_id, payload.memberId, targetWeekStart],
      );

      const goalKey = `${task.action_id}:${task.project_id}:${task.week_goal_title}`;
      let targetWeekGoalId = targetGoalIds.get(goalKey);
      if (!targetWeekGoalId) {
        const goalResult = await client.query<{ id: string }>(
          `INSERT INTO week_goals (
             week_plan_id, department_id, assigned_member_id, goal_id,
             action_id, project_id, week_start, title, description
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (week_plan_id, action_id, project_id, title)
           DO UPDATE SET description = COALESCE(week_goals.description, EXCLUDED.description)
           RETURNING id`,
          [
            planResult.rows[0].id,
            task.department_id,
            payload.memberId,
            task.goal_id,
            task.action_id,
            task.project_id,
            targetWeekStart,
            task.week_goal_title,
            task.week_goal_description,
          ],
        );
        targetWeekGoalId = goalResult.rows[0].id;
        targetGoalIds.set(goalKey, targetWeekGoalId);
      }

      const sourceOffset = Math.round(
        (Date.parse(`${task.task_date}T00:00:00Z`) - Date.parse(`${sourceWeekStart}T00:00:00Z`))
        / 86_400_000,
      );
      const targetTaskDate = addDays(targetWeekStart, Math.min(Math.max(sourceOffset, 0), 4));
      const inserted = await client.query(
        `INSERT INTO tasks (
           week_goal_id, action_id, project_id, assigned_member_id,
           week_start, title, description, task_date, status, carried_from_task_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'NOT_STARTED', $9)
         ON CONFLICT (carried_from_task_id)
           WHERE carried_from_task_id IS NOT NULL
         DO NOTHING
         RETURNING id`,
        [
          targetWeekGoalId,
          task.action_id,
          task.project_id,
          payload.memberId,
          targetWeekStart,
          task.title,
          task.description,
          targetTaskDate,
          task.id,
        ],
      );
      carriedTaskCount += inserted.rowCount ?? 0;
    }

    await client.query('COMMIT');

    revalidatePath(`/members/${payload.memberId}`);
    revalidatePath('/projects');
    revalidatePath('/workload');
    revalidatePath('/dashboard');
    for (const departmentId of departmentIds) revalidatePath(`/departments/${departmentId}`);
    for (const projectId of projectIds) revalidatePath(`/projects/${projectId}`);

    return Response.json({
      carriedTaskCount,
      skippedTaskCount: sourceResult.rows.length - eligibleTasks.length,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (typeof error === 'object' && error && 'code' in error && error.code === '23514') {
      return Response.json(
        { error: 'Unfinished tasks can only be carried into active planning assignments.' },
        { status: 400 },
      );
    }
    console.error('Could not carry tasks forward:', error);
    return Response.json({ error: 'Could not carry unfinished tasks forward.' }, { status: 500 });
  } finally {
    client.release();
  }
}
