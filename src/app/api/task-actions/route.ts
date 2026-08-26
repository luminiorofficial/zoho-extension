import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isUuid, textValue } from '@/lib/planner-validation';

interface TaskActionPayload {
  taskId?: unknown;
  title?: unknown;
}

export async function POST(request: Request) {
  let payload: TaskActionPayload;

  try {
    payload = await request.json() as TaskActionPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const title = textValue(payload.title, 1000);

  if (!isUuid(payload.taskId) || !title) {
    return Response.json(
      { error: 'A valid task and action title are required.' },
      { status: 400 },
    );
  }

  try {
    const result = await db.query<{
      id: string;
      taskId: string;
      title: string;
      memberId: string;
      departmentId: string;
      projectId: string;
    }>(
      `WITH inserted AS (
         INSERT INTO task_actions (task_id, title)
         SELECT t.id, $2
           FROM tasks t
          WHERE t.id = $1
            AND t.week_start = DATE_TRUNC('week', CURRENT_DATE)::date
         RETURNING id, task_id, title
       )
       SELECT inserted.id,
              inserted.task_id AS "taskId",
              inserted.title,
              t.assigned_member_id AS "memberId",
              wg.department_id AS "departmentId",
              t.project_id AS "projectId"
         FROM inserted
         JOIN tasks t ON t.id = inserted.task_id
         JOIN week_goals wg ON wg.id = t.week_goal_id`,
      [payload.taskId, title],
    );

    const taskAction = result.rows[0];
    if (!taskAction) {
      return Response.json(
        { error: 'Current-week task not found.' },
        { status: 404 },
      );
    }

    revalidatePath(`/members/${taskAction.memberId}`);
    revalidatePath(`/departments/${taskAction.departmentId}`);
    revalidatePath(`/projects/${taskAction.projectId}`);

    return Response.json(
      {
        taskAction: {
          id: taskAction.id,
          taskId: taskAction.taskId,
          title: taskAction.title,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Could not create task action:', error);
    return Response.json({ error: 'Could not create the task action.' }, { status: 500 });
  }
}
