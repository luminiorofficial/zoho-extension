import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isDate, isUuid, textValue } from '@/lib/planner-validation';

interface TaskPatchPayload {
  title?: unknown;
  description?: unknown;
  taskDate?: unknown;
  status?: unknown;
}

const statuses = new Set(['NOT_STARTED', 'IN_PROGRESS', 'DONE']);

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/tasks/[id]'>,
) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return Response.json({ error: 'Invalid task id.' }, { status: 400 });
  }

  let payload: TaskPatchPayload;
  try {
    payload = await request.json() as TaskPatchPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const changes: string[] = [];
  const values: unknown[] = [id];

  if ('title' in payload) {
    const title = textValue(payload.title, 500);
    if (!title) return Response.json({ error: 'Task title cannot be empty.' }, { status: 400 });
    values.push(title);
    changes.push(`title = $${values.length}`);
  }

  if ('description' in payload) {
    const description = textValue(payload.description, 5000);
    if (description === null) {
      return Response.json({ error: 'Task notes must be 5,000 characters or fewer.' }, { status: 400 });
    }
    values.push(description || null);
    changes.push(`description = $${values.length}`);
  }

  if ('taskDate' in payload) {
    if (!isDate(payload.taskDate)) {
      return Response.json({ error: 'Invalid task date.' }, { status: 400 });
    }
    values.push(payload.taskDate);
    changes.push(`task_date = $${values.length}`);
  }

  if ('status' in payload) {
    if (typeof payload.status !== 'string' || !statuses.has(payload.status)) {
      return Response.json({ error: 'Invalid task status.' }, { status: 400 });
    }
    values.push(payload.status);
    changes.push(`status = $${values.length}`);
  }

  if (!changes.length) {
    return Response.json({ error: 'No supported task changes were provided.' }, { status: 400 });
  }

  try {
    if (isDate(payload.taskDate)) {
      const weekResult = await db.query<{ is_in_week: boolean }>(
        `SELECT $2::date BETWEEN week_start AND week_start + 4 AS is_in_week
           FROM tasks
          WHERE id = $1`,
        [id, payload.taskDate],
      );

      if (!weekResult.rows[0]) {
        return Response.json({ error: 'Task not found.' }, { status: 404 });
      }
      if (!weekResult.rows[0].is_in_week) {
        return Response.json(
          { error: 'The task date must fall Monday–Friday within its weekly goal.' },
          { status: 400 },
        );
      }
    }

    const result = await db.query(
      `WITH updated AS (
         UPDATE tasks
            SET ${changes.join(', ')}
          WHERE id = $1
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
         FROM updated t
         JOIN week_goals wg ON wg.id = t.week_goal_id
         JOIN actions a ON a.id = t.action_id
         JOIN projects p ON p.id = t.project_id`,
      values,
    );

    const task = result.rows[0];
    if (!task) return Response.json({ error: 'Task not found.' }, { status: 404 });

    revalidatePath(`/members/${task.assignedMemberId}`);
    revalidatePath(`/departments/${task.departmentId}`);
    revalidatePath(`/projects/${task.projectId}`);
    revalidatePath('/projects');
    revalidatePath('/workload');
    revalidatePath('/dashboard');

    return Response.json({ task });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23514') {
      return Response.json(
        { error: 'Daily tasks must remain in an active Monday–Friday weekly plan.' },
        { status: 400 },
      );
    }
    console.error('Could not update task:', error);
    return Response.json({ error: 'Could not update the daily task.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<'/api/tasks/[id]'>,
) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return Response.json({ error: 'Invalid task id.' }, { status: 400 });
  }

  try {
    const result = await db.query<{
      id: string;
      assignedMemberId: string;
      departmentId: string;
      projectId: string;
    }>(
      `WITH deleted AS (
         DELETE FROM tasks
          WHERE id = $1
          RETURNING id, week_goal_id, assigned_member_id
       )
       SELECT d.id,
              d.assigned_member_id AS "assignedMemberId",
              wg.department_id AS "departmentId",
              wg.project_id AS "projectId"
         FROM deleted d
         JOIN week_goals wg ON wg.id = d.week_goal_id`,
      [id],
    );

    const task = result.rows[0];
    if (!task) return Response.json({ error: 'Task not found.' }, { status: 404 });

    revalidatePath(`/members/${task.assignedMemberId}`);
    revalidatePath(`/departments/${task.departmentId}`);
    revalidatePath(`/projects/${task.projectId}`);
    revalidatePath('/projects');
    revalidatePath('/workload');
    revalidatePath('/dashboard');

    return Response.json({ deletedTaskId: task.id });
  } catch (error) {
    console.error('Could not delete task:', error);
    return Response.json({ error: 'Could not delete the daily task.' }, { status: 500 });
  }
}
