import { db } from '@/lib/db';
import { isAssignmentStatusCode } from '@/lib/assignment-status';
import { isDate, isUuid } from '@/lib/planner-validation';
import { revalidateKeyAssignmentViews } from '@/lib/revalidate-assignments';

interface AssignmentPayload {
  keyId?: unknown;
  subGoalId?: unknown;
  projectId?: unknown;
  taskId?: unknown;
  memberId?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  status?: unknown;
}

export async function POST(request: Request) {
  let payload: AssignmentPayload;
  try {
    payload = await request.json() as AssignmentPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const status = typeof payload.status === 'string' ? payload.status : 'NOT_STARTED';
  if (
    !isUuid(payload.keyId)
    || !isUuid(payload.subGoalId)
    || !isUuid(payload.projectId)
    || !isUuid(payload.taskId)
    || !isUuid(payload.memberId)
    || !isDate(payload.startDate)
    || !isDate(payload.endDate)
    || payload.endDate < payload.startDate
    || !isAssignmentStatusCode(status)
  ) {
    return Response.json(
      { error: 'Complete the assignment with valid selections, dates, and status.' },
      { status: 400 },
    );
  }

  try {
    const result = await db.query<{
      id: string;
      department_id: string;
    }>(
      `WITH inserted AS (
         INSERT INTO key_assignments (
           key_id, sub_goal_id, project_id, task_id, member_id,
           start_date, end_date, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, project_id
       )
       SELECT inserted.id, projects.department_id
         FROM inserted
         JOIN projects ON projects.id = inserted.project_id`,
      [
        payload.keyId,
        payload.subGoalId,
        payload.projectId,
        payload.taskId,
        payload.memberId,
        payload.startDate,
        payload.endDate,
        status,
      ],
    );

    const assignment = result.rows[0];
    revalidateKeyAssignmentViews({
      departmentId: assignment.department_id,
      projectId: payload.projectId,
      memberId: payload.memberId,
    });
    return Response.json({ assignment: { id: assignment.id } }, { status: 201 });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23514') {
      return Response.json(
        { error: 'Use an active sub goal, project, task, member, and a valid date range.' },
        { status: 400 },
      );
    }
    if (typeof error === 'object' && error && 'code' in error && error.code === '23503') {
      return Response.json({ error: 'One or more selected records no longer exist.' }, { status: 400 });
    }
    console.error('Could not create key assignment:', error);
    return Response.json({ error: 'Could not create the assignment.' }, { status: 500 });
  }
}
