import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isUuid, textValue } from '@/lib/planner-validation';

interface TaskActionPatchPayload {
  title?: unknown;
  status?: unknown;
}

const statuses = new Set(['NOT_STARTED', 'STARTED', 'IN_PROGRESS', 'DONE']);

function revalidatePlannerPaths(item: {
  memberId: string;
  departmentId: string;
  projectId: string;
}) {
  revalidatePath(`/members/${item.memberId}`);
  revalidatePath(`/departments/${item.departmentId}`);
  revalidatePath(`/projects/${item.projectId}`);
  revalidatePath('/projects');
  revalidatePath('/workload');
  revalidatePath('/dashboard');
}

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/task-actions/[id]'>,
) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return Response.json({ error: 'Invalid task action id.' }, { status: 400 });
  }

  let payload: TaskActionPatchPayload;
  try {
    payload = await request.json() as TaskActionPatchPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const changes: string[] = [];
  const values: unknown[] = [id];

  if ('title' in payload) {
    const title = textValue(payload.title, 1000);
    if (!title) {
      return Response.json({ error: 'Task action title cannot be empty.' }, { status: 400 });
    }
    values.push(title);
    changes.push(`title = $${values.length}`);
  }

  if ('status' in payload) {
    if (typeof payload.status !== 'string' || !statuses.has(payload.status)) {
      return Response.json({ error: 'Invalid task action status.' }, { status: 400 });
    }
    values.push(payload.status);
    changes.push(`status = $${values.length}`);
  }

  if (!changes.length) {
    return Response.json({ error: 'No supported task action changes were provided.' }, { status: 400 });
  }

  try {
    const result = await db.query<{
      id: string;
      taskId: string;
      title: string;
      status: string;
      memberId: string;
      departmentId: string;
      projectId: string;
    }>(
      `WITH updated AS (
         UPDATE task_actions ta
            SET ${changes.join(', ')}
           FROM tasks t
          WHERE ta.id = $1
            AND t.id = ta.task_id
            AND t.week_start = DATE_TRUNC('week', CURRENT_DATE)::date
        RETURNING ta.id, ta.task_id, ta.title, ta.status
       )
       SELECT updated.id,
              updated.task_id AS "taskId",
              updated.title,
              CASE updated.status
                WHEN 'DONE' THEN 'Done'
                WHEN 'IN_PROGRESS' THEN 'In Progress'
                WHEN 'STARTED' THEN 'Started'
                ELSE 'Not Started'
              END AS status,
              t.assigned_member_id AS "memberId",
              wg.department_id AS "departmentId",
              t.project_id AS "projectId"
         FROM updated
         JOIN tasks t ON t.id = updated.task_id
         JOIN week_goals wg ON wg.id = t.week_goal_id`,
      values,
    );

    const taskAction = result.rows[0];
    if (!taskAction) {
      return Response.json({ error: 'Current-week task action not found.' }, { status: 404 });
    }

    revalidatePlannerPaths(taskAction);
    return Response.json({
      taskAction: {
        id: taskAction.id,
        taskId: taskAction.taskId,
        title: taskAction.title,
        status: taskAction.status,
      },
    });
  } catch (error) {
    console.error('Could not update task action:', error);
    return Response.json({ error: 'Could not update the task action.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<'/api/task-actions/[id]'>,
) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return Response.json({ error: 'Invalid task action id.' }, { status: 400 });
  }

  try {
    const result = await db.query<{
      id: string;
      memberId: string;
      departmentId: string;
      projectId: string;
    }>(
      `WITH deleted AS (
         DELETE FROM task_actions ta
          USING tasks t
          WHERE ta.id = $1
            AND t.id = ta.task_id
            AND t.week_start = DATE_TRUNC('week', CURRENT_DATE)::date
        RETURNING ta.id, ta.task_id
       )
       SELECT deleted.id,
              t.assigned_member_id AS "memberId",
              wg.department_id AS "departmentId",
              t.project_id AS "projectId"
         FROM deleted
         JOIN tasks t ON t.id = deleted.task_id
         JOIN week_goals wg ON wg.id = t.week_goal_id`,
      [id],
    );

    const taskAction = result.rows[0];
    if (!taskAction) {
      return Response.json({ error: 'Current-week task action not found.' }, { status: 404 });
    }

    revalidatePlannerPaths(taskAction);
    return Response.json({ deletedTaskActionId: taskAction.id });
  } catch (error) {
    console.error('Could not delete task action:', error);
    return Response.json({ error: 'Could not delete the task action.' }, { status: 500 });
  }
}
