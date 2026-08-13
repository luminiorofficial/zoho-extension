import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';

interface TaskPatchPayload {
  title?: unknown;
  description?: unknown;
  status?: unknown;
}

const statuses = new Set(['NOT_STARTED', 'IN_PROGRESS', 'DONE']);

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

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
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    if (!title) return Response.json({ error: 'Task title cannot be empty.' }, { status: 400 });
    values.push(title);
    changes.push(`title = $${values.length}`);
  }

  if ('description' in payload) {
    const description = typeof payload.description === 'string'
      ? payload.description.trim()
      : '';
    values.push(description || null);
    changes.push(`description = $${values.length}`);
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
    revalidatePath('/dashboard');

    return Response.json({ task });
  } catch (error) {
    console.error('Could not update task:', error);
    return Response.json({ error: 'Could not update the daily task.' }, { status: 500 });
  }
}
