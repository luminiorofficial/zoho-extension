import { db } from '@/lib/db';
import { isAssignmentStatusCode } from '@/lib/assignment-status';
import { isDate, isUuid } from '@/lib/planner-validation';
import { revalidateKeyAssignmentViews } from '@/lib/revalidate-assignments';

interface AssignmentPatchPayload {
  keyId?: unknown;
  subGoalId?: unknown;
  projectId?: unknown;
  taskId?: unknown;
  memberId?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  status?: unknown;
}

interface AssignmentScope {
  project_id: string;
  member_id: string;
  department_id: string;
  start_date: string;
  end_date: string;
}

function refreshScope(scope: AssignmentScope) {
  revalidateKeyAssignmentViews({
    departmentId: scope.department_id,
    projectId: scope.project_id,
    memberId: scope.member_id,
  });
}

async function assignmentScope(id: string): Promise<AssignmentScope | undefined> {
  const result = await db.query<AssignmentScope>(
    `SELECT ka.project_id, ka.member_id, p.department_id,
            ka.start_date::text, ka.end_date::text
       FROM key_assignments ka
       JOIN projects p ON p.id = ka.project_id
      WHERE ka.id = $1`,
    [id],
  );
  return result.rows[0];
}

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/key-assignments/[id]'>,
) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: 'Invalid assignment id.' }, { status: 400 });

  let payload: AssignmentPatchPayload;
  try {
    payload = await request.json() as AssignmentPatchPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const previous = await assignmentScope(id);
  if (!previous) return Response.json({ error: 'Assignment not found.' }, { status: 404 });

  const changes: string[] = [];
  const values: unknown[] = [id];
  const add = (column: string, value: unknown) => {
    values.push(value);
    changes.push(`${column} = $${values.length}`);
  };

  const uuidFields: [keyof AssignmentPatchPayload, string][] = [
    ['keyId', 'key_id'],
    ['subGoalId', 'sub_goal_id'],
    ['projectId', 'project_id'],
    ['taskId', 'task_id'],
    ['memberId', 'member_id'],
  ];
  for (const [field, column] of uuidFields) {
    if (field in payload) {
      if (!isUuid(payload[field])) {
        return Response.json({ error: `Invalid ${field}.` }, { status: 400 });
      }
      add(column, payload[field]);
    }
  }

  if ('startDate' in payload) {
    if (!isDate(payload.startDate)) return Response.json({ error: 'Invalid start date.' }, { status: 400 });
    add('start_date', payload.startDate);
  }
  if ('endDate' in payload) {
    if (!isDate(payload.endDate)) return Response.json({ error: 'Invalid end date.' }, { status: 400 });
    add('end_date', payload.endDate);
  }
  if ('status' in payload) {
    if (!isAssignmentStatusCode(payload.status)) {
      return Response.json({ error: 'Invalid assignment status.' }, { status: 400 });
    }
    add('status', payload.status);
  }

  const startDate = isDate(payload.startDate) ? payload.startDate : previous.start_date;
  const endDate = isDate(payload.endDate) ? payload.endDate : previous.end_date;
  if (endDate < startDate) {
    return Response.json({ error: 'End date cannot be before start date.' }, { status: 400 });
  }
  if (!changes.length) {
    return Response.json({ error: 'No supported assignment changes were provided.' }, { status: 400 });
  }

  try {
    const result = await db.query<AssignmentScope & { id: string }>(
      `WITH updated AS (
         UPDATE key_assignments
            SET ${changes.join(', ')}
          WHERE id = $1
          RETURNING id, project_id, member_id, start_date, end_date
       )
       SELECT updated.id, updated.project_id, updated.member_id,
              projects.department_id, updated.start_date::text, updated.end_date::text
         FROM updated
         JOIN projects ON projects.id = updated.project_id`,
      values,
    );
    const updated = result.rows[0];
    if (!updated) return Response.json({ error: 'Assignment not found.' }, { status: 404 });

    refreshScope(previous);
    refreshScope(updated);
    return Response.json({ assignment: { id } });
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
    console.error('Could not update key assignment:', error);
    return Response.json({ error: 'Could not update the assignment.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<'/api/key-assignments/[id]'>,
) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: 'Invalid assignment id.' }, { status: 400 });

  const previous = await assignmentScope(id);
  if (!previous) return Response.json({ error: 'Assignment not found.' }, { status: 404 });

  try {
    const result = await db.query<{ id: string }>(
      `DELETE FROM key_assignments WHERE id = $1 RETURNING id`,
      [id],
    );
    if (!result.rows[0]) return Response.json({ error: 'Assignment not found.' }, { status: 404 });

    refreshScope(previous);
    return Response.json({ deletedAssignmentId: id });
  } catch (error) {
    console.error('Could not delete key assignment:', error);
    return Response.json({ error: 'Could not delete the assignment.' }, { status: 500 });
  }
}
