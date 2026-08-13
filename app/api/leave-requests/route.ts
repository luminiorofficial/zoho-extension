import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isDate, isUuid } from '@/lib/planner-validation';

interface LeaveRequestPayload {
  departmentId?: unknown;
  memberId?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  reason?: unknown;
}

export async function POST(request: Request) {
  let payload: LeaveRequestPayload;
  try {
    payload = await request.json() as LeaveRequestPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
  if (
    !isUuid(payload.departmentId)
    || !isUuid(payload.memberId)
    || !isDate(payload.startDate)
    || !isDate(payload.endDate)
    || payload.endDate < payload.startDate
    || !reason
  ) {
    return Response.json(
      { error: 'Department, member, valid date range, and reason are required.' },
      { status: 400 },
    );
  }

  try {
    const result = await db.query(
      `INSERT INTO leave_requests (
         department_id, member_id, start_date, end_date, reason
       )
       SELECT dm.department_id, dm.member_id, $3::date, $4::date, $5
         FROM department_members dm
         JOIN members m ON m.id = dm.member_id AND m.is_active
        WHERE dm.department_id = $1 AND dm.member_id = $2
       RETURNING id, department_id AS "departmentId", member_id AS "memberId",
                 start_date::text AS "startDate", end_date::text AS "endDate",
                 reason, status`,
      [payload.departmentId, payload.memberId, payload.startDate, payload.endDate, reason],
    );

    if (!result.rows[0]) {
      return Response.json({ error: 'The member does not belong to this department.' }, { status: 400 });
    }

    revalidatePath('/attendance');
    revalidatePath(`/members/${payload.memberId}`);
    return Response.json({ leaveRequest: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Could not create leave request:', error);
    return Response.json({ error: 'Could not submit the leave request.' }, { status: 500 });
  }
}
