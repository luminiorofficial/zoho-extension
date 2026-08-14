import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isOptionalDate, isUuid, textValue } from '@/lib/planner-validation';

interface GoalPatchPayload {
  ownerMemberId?: unknown;
  code?: unknown;
  title?: unknown;
  description?: unknown;
  status?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  isActive?: unknown;
}

const statuses = new Set(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'ON_HOLD', 'CANCELLED']);

function refreshGoal(departmentId: string) {
  revalidatePath('/departments');
  revalidatePath(`/departments/${departmentId}`);
  revalidatePath('/projects');
  revalidatePath('/workload');
  revalidatePath('/dashboard');
}

export async function PATCH(request: Request, context: RouteContext<'/api/goals/[id]'>) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: 'Invalid goal id.' }, { status: 400 });

  let payload: GoalPatchPayload;
  try {
    payload = await request.json() as GoalPatchPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const currentResult = await db.query<{
    department_id: string;
    owner_member_id: string | null;
    start_date: string | null;
    end_date: string | null;
  }>(
    `SELECT department_id, owner_member_id, start_date::text, end_date::text FROM goals WHERE id = $1`,
    [id],
  );
  const current = currentResult.rows[0];
  if (!current) return Response.json({ error: 'Goal not found.' }, { status: 404 });

  const changes: string[] = [];
  const values: unknown[] = [id];
  const add = (column: string, value: unknown, cast = '') => {
    values.push(value);
    changes.push(`${column} = $${values.length}${cast}`);
  };

  let nextOwnerId = current.owner_member_id;
  if ('ownerMemberId' in payload) {
    if (!isUuid(payload.ownerMemberId)) return Response.json({ error: 'Select a valid goal owner.' }, { status: 400 });
    nextOwnerId = payload.ownerMemberId;
    add('owner_member_id', payload.ownerMemberId);
  }
  if ('code' in payload) {
    const code = textValue(payload.code, 100);
    if (code === null) return Response.json({ error: 'Goal code is too long.' }, { status: 400 });
    add('code', code || null);
  }
  if ('title' in payload) {
    const title = textValue(payload.title);
    if (!title) return Response.json({ error: 'Goal title is required.' }, { status: 400 });
    const duplicate = await db.query(
      `SELECT 1 FROM goals WHERE department_id = $1 AND LOWER(title) = LOWER($2) AND id <> $3 LIMIT 1`,
      [current.department_id, title, id],
    );
    if (duplicate.rows[0]) return Response.json({ error: 'A goal with this title already exists.' }, { status: 409 });
    add('title', title);
  }
  if ('description' in payload) {
    const description = textValue(payload.description);
    if (description === null) return Response.json({ error: 'Invalid description.' }, { status: 400 });
    add('description', description || null);
  }
  if ('status' in payload) {
    const status = textValue(payload.status, 30);
    if (!status || !statuses.has(status)) return Response.json({ error: 'Invalid goal status.' }, { status: 400 });
    add('status', status);
  }
  if ('isActive' in payload) {
    if (typeof payload.isActive !== 'boolean') return Response.json({ error: 'Invalid active status.' }, { status: 400 });
    add('is_active', payload.isActive);
  }
  if ('startDate' in payload) {
    if (!isOptionalDate(payload.startDate)) return Response.json({ error: 'Invalid start date.' }, { status: 400 });
    add('start_date', payload.startDate || null, '::date');
  }
  if ('endDate' in payload) {
    if (!isOptionalDate(payload.endDate)) return Response.json({ error: 'Invalid end date.' }, { status: 400 });
    add('end_date', payload.endDate || null, '::date');
  }
  const nextStart = 'startDate' in payload ? (payload.startDate || null) : current.start_date;
  const nextEnd = 'endDate' in payload ? (payload.endDate || null) : current.end_date;
  if (typeof nextStart === 'string' && typeof nextEnd === 'string' && nextEnd < nextStart) {
    return Response.json({ error: 'Goal end date cannot be before its start date.' }, { status: 400 });
  }
  if (!changes.length) return Response.json({ error: 'No supported goal changes were provided.' }, { status: 400 });

  const ownerChanged = 'ownerMemberId' in payload && nextOwnerId !== current.owner_member_id;
  if (nextOwnerId && (ownerChanged || payload.isActive === true)) {
    const hierarchy = await db.query(
      `SELECT 1 FROM department_members dm
       JOIN departments d ON d.id = dm.department_id
       JOIN members m ON m.id = dm.member_id
       WHERE dm.department_id = $1 AND dm.member_id = $2 AND d.is_active AND m.is_active`,
      [current.department_id, nextOwnerId],
    );
    if (!hierarchy.rows[0]) return Response.json({ error: 'The goal owner must be an active department member.' }, { status: 400 });
  }

  try {
    await db.query(`UPDATE goals SET ${changes.join(', ')} WHERE id = $1`, values);
    refreshGoal(current.department_id);
    return Response.json({ goal: { id } });
  } catch (error) {
    console.error('Could not update goal:', error);
    return Response.json({ error: 'Could not update the goal.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<'/api/goals/[id]'>) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: 'Invalid goal id.' }, { status: 400 });
  try {
    const result = await db.query<{ department_id: string }>(
      `UPDATE goals SET is_active = FALSE WHERE id = $1 RETURNING department_id`,
      [id],
    );
    if (!result.rows[0]) return Response.json({ error: 'Goal not found.' }, { status: 404 });
    refreshGoal(result.rows[0].department_id);
    return Response.json({ goal: { id, isActive: false } });
  } catch (error) {
    console.error('Could not deactivate goal:', error);
    return Response.json({ error: 'Could not deactivate the goal.' }, { status: 500 });
  }
}
