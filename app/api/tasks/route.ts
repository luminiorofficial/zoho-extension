import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isDate, isUuid } from '@/lib/planner-validation';

interface TaskPayload {
  memberId?: unknown;
  weekGoalId?: unknown;
  title?: unknown;
  description?: unknown;
  taskDate?: unknown;
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

  if (
    !isUuid(payload.memberId)
    || !isUuid(payload.weekGoalId)
    || !isDate(payload.taskDate)
    || !title
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
         WHERE wg.id = $1
           AND wg.assigned_member_id = $2
           AND $5::date BETWEEN wg.week_start AND wg.week_start + 6
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
        { error: 'The task date must fall within the selected weekly goal.' },
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

    return Response.json({ task }, { status: 201 });
  } catch (error) {
    console.error('Could not create task:', error);
    return Response.json({ error: 'Could not create the daily task.' }, { status: 500 });
  }
}
