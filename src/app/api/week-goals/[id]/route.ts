import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isUuid, textValue } from '@/lib/planner-validation';

interface WeekGoalPatchPayload {
  memberId?: unknown;
  title?: unknown;
  description?: unknown;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return Response.json({ error: 'Invalid weekly goal id.' }, { status: 400 });
  }

  let payload: WeekGoalPatchPayload;
  try {
    payload = await request.json() as WeekGoalPatchPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!isUuid(payload.memberId)) {
    return Response.json({ error: 'A valid assigned member is required.' }, { status: 400 });
  }

  const changes: string[] = [];
  const values: unknown[] = [id, payload.memberId];

  if ('title' in payload) {
    const title = textValue(payload.title, 500);
    if (!title) {
      return Response.json(
        { error: 'Weekly goal title is required and must be 500 characters or fewer.' },
        { status: 400 },
      );
    }
    values.push(title);
    changes.push(`title = $${values.length}`);
  }

  if ('description' in payload) {
    const description = textValue(payload.description, 5000);
    if (description === null) {
      return Response.json(
        { error: 'Weekly goal notes must be 5,000 characters or fewer.' },
        { status: 400 },
      );
    }
    values.push(description || null);
    changes.push(`description = $${values.length}`);
  }

  if (!changes.length) {
    return Response.json({ error: 'No supported weekly goal changes were provided.' }, { status: 400 });
  }

  try {
    const result = await db.query<{
      id: string;
      departmentId: string;
      projectId: string;
    }>(
      `UPDATE week_goals
          SET ${changes.join(', ')}
        WHERE id = $1
          AND assigned_member_id = $2
          AND week_start = DATE_TRUNC('week', CURRENT_DATE)::date
      RETURNING id,
                department_id AS "departmentId",
                project_id AS "projectId"`,
      values,
    );

    const weekGoal = result.rows[0];
    if (!weekGoal) {
      return Response.json(
        { error: 'Current-week goal not found for this member.' },
        { status: 404 },
      );
    }

    revalidatePath(`/members/${payload.memberId}`);
    revalidatePath(`/departments/${weekGoal.departmentId}`);
    revalidatePath(`/projects/${weekGoal.projectId}`);
    revalidatePath('/projects');

    return Response.json({ weekGoal: { id: weekGoal.id } });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      return Response.json(
        { error: 'That weekly goal title is already in use for this action and project.' },
        { status: 409 },
      );
    }
    console.error('Could not update weekly goal:', error);
    return Response.json({ error: 'Could not update the weekly goal.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<'/api/week-goals/[id]'>,
) {
  const { id } = await context.params;
  if (!isUuid(id)) {
    return Response.json({ error: 'Invalid weekly goal id.' }, { status: 400 });
  }

  try {
    const result = await db.query<{
      id: string;
      assignedMemberId: string;
      departmentId: string;
      projectId: string;
    }>(
      `DELETE FROM week_goals
        WHERE id = $1
          AND week_start = DATE_TRUNC('week', CURRENT_DATE)::date
      RETURNING id,
                assigned_member_id AS "assignedMemberId",
                department_id AS "departmentId",
                project_id AS "projectId"`,
      [id],
    );

    const weekGoal = result.rows[0];
    if (!weekGoal) {
      return Response.json({ error: 'Current-week goal not found.' }, { status: 404 });
    }

    revalidatePath(`/members/${weekGoal.assignedMemberId}`);
    revalidatePath(`/departments/${weekGoal.departmentId}`);
    revalidatePath(`/projects/${weekGoal.projectId}`);
    revalidatePath('/projects');
    revalidatePath('/workload');
    revalidatePath('/dashboard');

    return Response.json({ deletedWeekGoalId: weekGoal.id });
  } catch (error) {
    console.error('Could not delete weekly goal:', error);
    return Response.json({ error: 'Could not delete the weekly goal.' }, { status: 500 });
  }
}
