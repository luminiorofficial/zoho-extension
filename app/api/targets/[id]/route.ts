import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isOptionalDate, isUuid, textValue } from '@/lib/planner-validation';

interface TargetPatchPayload {
  title?: unknown;
  targetText?: unknown;
  targetValue?: unknown;
  targetUnit?: unknown;
  periodType?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  isActive?: unknown;
}

const periods = new Set(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM']);

function optionalNumber(value: unknown): number | null | undefined {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function refreshTarget(departmentId: string) {
  revalidatePath(`/departments/${departmentId}`);
  revalidatePath('/departments');
  revalidatePath('/dashboard');
}

export async function PATCH(request: Request, context: RouteContext<'/api/targets/[id]'>) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: 'Invalid target id.' }, { status: 400 });
  let payload: TargetPatchPayload;
  try {
    payload = await request.json() as TargetPatchPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const currentResult = await db.query<{
    goal_id: string;
    department_id: string;
    start_date: string | null;
    end_date: string | null;
  }>(
    `SELECT t.goal_id, g.department_id, t.start_date::text, t.end_date::text
       FROM targets t JOIN goals g ON g.id = t.goal_id WHERE t.id = $1`,
    [id],
  );
  const current = currentResult.rows[0];
  if (!current) return Response.json({ error: 'Target not found.' }, { status: 404 });

  const changes: string[] = [];
  const values: unknown[] = [id];
  const add = (column: string, value: unknown, cast = '') => {
    values.push(value);
    changes.push(`${column} = $${values.length}${cast}`);
  };
  if ('title' in payload) {
    const title = textValue(payload.title);
    if (!title) return Response.json({ error: 'Target title is required.' }, { status: 400 });
    const duplicate = await db.query(
      `SELECT 1 FROM targets WHERE goal_id = $1 AND LOWER(title) = LOWER($2) AND id <> $3 LIMIT 1`,
      [current.goal_id, title, id],
    );
    if (duplicate.rows[0]) return Response.json({ error: 'A target with this title already exists.' }, { status: 409 });
    add('title', title);
  }
  if ('targetText' in payload) {
    const value = textValue(payload.targetText);
    if (value === null) return Response.json({ error: 'Invalid target details.' }, { status: 400 });
    add('target_text', value || null);
  }
  if ('targetValue' in payload) {
    const value = optionalNumber(payload.targetValue);
    if (value === undefined) return Response.json({ error: 'Target value must be numeric.' }, { status: 400 });
    add('target_value', value);
  }
  if ('targetUnit' in payload) {
    const value = textValue(payload.targetUnit, 100);
    if (value === null) return Response.json({ error: 'Target unit is too long.' }, { status: 400 });
    add('target_unit', value || null);
  }
  if ('periodType' in payload) {
    const value = textValue(payload.periodType, 30);
    if (value === null || (value && !periods.has(value))) return Response.json({ error: 'Invalid target period.' }, { status: 400 });
    add('period_type', value || null);
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
  const startDate = 'startDate' in payload ? payload.startDate || null : current.start_date;
  const endDate = 'endDate' in payload ? payload.endDate || null : current.end_date;
  if (typeof startDate === 'string' && typeof endDate === 'string' && endDate < startDate) {
    return Response.json({ error: 'Target end date cannot be before its start date.' }, { status: 400 });
  }
  if (!changes.length) return Response.json({ error: 'No supported target changes were provided.' }, { status: 400 });

  if (payload.isActive === true) {
    const activeParent = await db.query(
      `SELECT 1 FROM goals g JOIN departments d ON d.id = g.department_id
        WHERE g.id = $1 AND g.is_active AND d.is_active`,
      [current.goal_id],
    );
    if (!activeParent.rows[0]) return Response.json({ error: 'Reactivate the goal and department first.' }, { status: 409 });
  }

  try {
    await db.query(`UPDATE targets SET ${changes.join(', ')} WHERE id = $1`, values);
    refreshTarget(current.department_id);
    return Response.json({ target: { id } });
  } catch (error) {
    console.error('Could not update target:', error);
    return Response.json({ error: 'Could not update the target.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<'/api/targets/[id]'>) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: 'Invalid target id.' }, { status: 400 });
  try {
    const result = await db.query<{ department_id: string }>(
      `UPDATE targets t SET is_active = FALSE
       FROM goals g WHERE t.id = $1 AND g.id = t.goal_id RETURNING g.department_id`,
      [id],
    );
    if (!result.rows[0]) return Response.json({ error: 'Target not found.' }, { status: 404 });
    refreshTarget(result.rows[0].department_id);
    return Response.json({ target: { id, isActive: false } });
  } catch (error) {
    console.error('Could not deactivate target:', error);
    return Response.json({ error: 'Could not deactivate the target.' }, { status: 500 });
  }
}
