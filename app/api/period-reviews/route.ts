import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isDate, isUuid } from '@/lib/planner-validation';
import { isReportPeriodType, reportingPeriod } from '@/lib/reporting-periods';
import { optionalReportingText, optionalScore, optionalUuid } from '@/lib/reporting-validation';

interface ReviewPayload {
  departmentId?: unknown;
  memberId?: unknown;
  goalId?: unknown;
  periodType?: unknown;
  periodDate?: unknown;
  score?: unknown;
  summary?: unknown;
  achievements?: unknown;
  challenges?: unknown;
  nextSteps?: unknown;
}

export async function POST(request: Request) {
  let payload: ReviewPayload;
  try {
    payload = await request.json() as ReviewPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const memberId = optionalUuid(payload.memberId);
  const goalId = optionalUuid(payload.goalId);
  const score = optionalScore(payload.score);
  const summary = optionalReportingText(payload.summary);
  const achievements = optionalReportingText(payload.achievements);
  const challenges = optionalReportingText(payload.challenges);
  const nextSteps = optionalReportingText(payload.nextSteps);
  if (
    !isUuid(payload.departmentId)
    || memberId === undefined
    || goalId === undefined
    || !isReportPeriodType(payload.periodType)
    || !isDate(payload.periodDate)
    || score === undefined
    || [summary, achievements, challenges, nextSteps].some((value) => value === undefined)
  ) {
    return Response.json({ error: 'Enter a valid evaluation scope, period, score (0–100), and text.' }, { status: 400 });
  }
  if (score === null && !summary && !achievements && !challenges && !nextSteps) {
    return Response.json({ error: 'Add a score or at least one evaluation note.' }, { status: 400 });
  }
  const period = reportingPeriod(payload.periodType, payload.periodDate);
  if (!period) return Response.json({ error: 'Invalid reporting period.' }, { status: 400 });

  try {
    const hierarchy = await db.query(
      `SELECT 1
         FROM departments d
        WHERE d.id = $1 AND d.is_active
          AND ($2::uuid IS NULL OR EXISTS (
            SELECT 1 FROM department_members dm
            JOIN members m ON m.id = dm.member_id
             WHERE dm.department_id = d.id AND dm.member_id = $2 AND m.is_active
          ))
          AND ($3::uuid IS NULL OR EXISTS (
            SELECT 1 FROM goals g
             WHERE g.id = $3 AND g.department_id = d.id AND g.is_active
          ))`,
      [payload.departmentId, memberId, goalId],
    );
    if (!hierarchy.rows[0]) {
      return Response.json({ error: 'The evaluation member and goal must belong to the selected active department.' }, { status: 400 });
    }

    const result = await db.query<{ id: string }>(
      `WITH existing AS (
         SELECT id
           FROM period_reviews
          WHERE department_id = $1
            AND member_id IS NOT DISTINCT FROM $2::uuid
            AND goal_id IS NOT DISTINCT FROM $3::uuid
            AND period_type = $4
            AND period_start = $5::date
            AND period_end = $6::date
            AND source_sheet IS NULL
          ORDER BY updated_at DESC
          LIMIT 1
       ), updated AS (
         UPDATE period_reviews pr
            SET score = $7,
                summary = NULLIF($8, ''),
                achievements = NULLIF($9, ''),
                challenges = NULLIF($10, ''),
                next_steps = NULLIF($11, '')
           FROM existing
          WHERE pr.id = existing.id
          RETURNING pr.id
       ), inserted AS (
         INSERT INTO period_reviews (
           department_id, member_id, goal_id, period_type, period_start, period_end,
           score, summary, achievements, challenges, next_steps
         )
         SELECT $1, $2, $3, $4, $5::date, $6::date,
                $7, NULLIF($8, ''), NULLIF($9, ''), NULLIF($10, ''), NULLIF($11, '')
          WHERE NOT EXISTS (SELECT 1 FROM existing)
         RETURNING id
       )
       SELECT id FROM updated UNION ALL SELECT id FROM inserted`,
      [
        payload.departmentId, memberId, goalId, period.type, period.start, period.end,
        score, summary, achievements, challenges, nextSteps,
      ],
    );
    revalidatePath('/reports');
    revalidatePath(`/departments/${payload.departmentId}`);
    return Response.json({ review: { id: result.rows[0].id } });
  } catch (error) {
    console.error('Could not save period evaluation:', error);
    return Response.json({ error: 'Could not save the period evaluation.' }, { status: 500 });
  }
}
