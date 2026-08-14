import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isOptionalDate, isUuid, textValue } from '@/lib/planner-validation';

interface TargetPayload {
  goalId?: unknown;
  title?: unknown;
  targetText?: unknown;
  targetValue?: unknown;
  targetUnit?: unknown;
  periodType?: unknown;
  startDate?: unknown;
  endDate?: unknown;
}

const periods = new Set(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM']);

function optionalNumber(value: unknown): number | null | undefined {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function POST(request: Request) {
  let payload: TargetPayload;
  try {
    payload = await request.json() as TargetPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const title = textValue(payload.title);
  const targetText = textValue(payload.targetText);
  const targetUnit = textValue(payload.targetUnit, 100);
  const periodType = textValue(payload.periodType, 30);
  const targetValue = optionalNumber(payload.targetValue);
  if (
    !isUuid(payload.goalId) || !title || targetText === null || targetUnit === null
    || periodType === null || (periodType && !periods.has(periodType))
    || targetValue === undefined || !isOptionalDate(payload.startDate) || !isOptionalDate(payload.endDate)
  ) {
    return Response.json({ error: 'Enter a title and valid KPI value, period, and dates.' }, { status: 400 });
  }
  const startDate = payload.startDate || null;
  const endDate = payload.endDate || null;
  if (typeof startDate === 'string' && typeof endDate === 'string' && endDate < startDate) {
    return Response.json({ error: 'Target end date cannot be before its start date.' }, { status: 400 });
  }

  try {
    const hierarchy = await db.query<{ department_id: string }>(
      `SELECT g.department_id
         FROM goals g JOIN departments d ON d.id = g.department_id
        WHERE g.id = $1 AND g.is_active AND d.is_active`,
      [payload.goalId],
    );
    if (!hierarchy.rows[0]) return Response.json({ error: 'Select an active goal in an active department.' }, { status: 400 });
    const duplicate = await db.query(
      `SELECT 1 FROM targets WHERE goal_id = $1 AND LOWER(title) = LOWER($2) LIMIT 1`,
      [payload.goalId, title],
    );
    if (duplicate.rows[0]) return Response.json({ error: 'A target with this title already exists for the goal.' }, { status: 409 });

    const result = await db.query<{ id: string }>(
      `INSERT INTO targets (
         goal_id, title, target_text, target_value, target_unit, period_type, start_date, end_date
       ) VALUES ($1, $2, NULLIF($3, ''), $4, NULLIF($5, ''), NULLIF($6, ''), $7::date, $8::date)
       RETURNING id`,
      [payload.goalId, title, targetText, targetValue, targetUnit, periodType, startDate, endDate],
    );
    revalidatePath(`/departments/${hierarchy.rows[0].department_id}`);
    revalidatePath('/departments');
    return Response.json({ target: { id: result.rows[0].id } }, { status: 201 });
  } catch (error) {
    console.error('Could not create target:', error);
    return Response.json({ error: 'Could not create the target.' }, { status: 500 });
  }
}
