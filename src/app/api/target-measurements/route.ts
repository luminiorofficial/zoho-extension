import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isDate, isUuid } from '@/lib/planner-validation';
import { isReportPeriodType, reportingPeriod } from '@/lib/reporting-periods';
import { nonNegativeNumber, optionalReportingText, optionalUuid } from '@/lib/reporting-validation';

interface MeasurementPayload {
  targetId?: unknown;
  memberId?: unknown;
  periodType?: unknown;
  periodDate?: unknown;
  achievedValue?: unknown;
  note?: unknown;
}

export async function POST(request: Request) {
  let payload: MeasurementPayload;
  try {
    payload = await request.json() as MeasurementPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const memberId = optionalUuid(payload.memberId);
  const achievedValue = nonNegativeNumber(payload.achievedValue);
  const note = optionalReportingText(payload.note, 2000);
  if (
    !isUuid(payload.targetId)
    || memberId === undefined
    || !isReportPeriodType(payload.periodType)
    || !isDate(payload.periodDate)
    || achievedValue === undefined
    || note === undefined
  ) {
    return Response.json({ error: 'Enter a valid target, period, non-negative achieved value, and note.' }, { status: 400 });
  }

  const period = reportingPeriod(payload.periodType, payload.periodDate);
  if (!period) return Response.json({ error: 'Invalid reporting period.' }, { status: 400 });

  try {
    const target = await db.query<{ department_id: string }>(
      `SELECT g.department_id
         FROM targets t
         JOIN goals g ON g.id = t.goal_id
         JOIN departments d ON d.id = g.department_id
        WHERE t.id = $1
          AND t.is_active AND g.is_active AND d.is_active
          AND (t.period_type = $2 OR t.period_type IS NULL)
          AND ($3::uuid IS NULL OR EXISTS (
            SELECT 1 FROM department_members dm
             WHERE dm.department_id = g.department_id AND dm.member_id = $3
          ))`,
      [payload.targetId, period.type, memberId],
    );
    if (!target.rows[0]) {
      return Response.json({ error: 'Select an active KPI and a member in its department for this period.' }, { status: 400 });
    }

    const result = await db.query<{ id: string; progress_percent: string }>(
      `INSERT INTO target_measurements (
         target_id, member_id, period_type, period_start, period_end, achieved_value, note
       ) VALUES ($1, $2, $3, $4::date, $5::date, $6, NULLIF($7, ''))
       ON CONFLICT (
         target_id,
         (COALESCE(member_id, '00000000-0000-0000-0000-000000000000'::uuid)),
         period_type,
         period_start,
         period_end
       ) DO UPDATE SET achieved_value = EXCLUDED.achieved_value,
                       note = EXCLUDED.note
       RETURNING id,
         CASE
           WHEN (SELECT target_value FROM targets WHERE id = $1) > 0
           THEN ROUND(($6 / (SELECT target_value FROM targets WHERE id = $1)) * 100, 2)
           ELSE NULL
         END AS progress_percent`,
      [payload.targetId, memberId, period.type, period.start, period.end, achievedValue, note],
    );

    revalidatePath('/reports');
    revalidatePath(`/departments/${target.rows[0].department_id}`);
    return Response.json({
      measurement: {
        id: result.rows[0].id,
        achievedValue,
        progress: Number(result.rows[0].progress_percent),
      },
    });
  } catch (error) {
    console.error('Could not record KPI achievement:', error);
    return Response.json({ error: 'Could not record KPI achievement.' }, { status: 500 });
  }
}
