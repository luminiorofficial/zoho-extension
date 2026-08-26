import { revalidatePath } from 'next/cache';

import { attendanceStatusValue, todayInIndia } from '@/lib/attendance-utils';
import { db } from '@/lib/db';
import { isUuid } from '@/lib/planner-validation';
import { ATTENDANCE_STATUSES, type AttendanceStatus } from '@/types';

interface AttendancePayload {
  memberId?: unknown;
  status?: unknown;
  note?: unknown;
}

const memberMarkableStatuses = new Set<AttendanceStatus>([
  'Present',
  'Half Day',
  'Absent',
  'Work on Holiday',
]);

export async function POST(request: Request) {
  let payload: AttendancePayload;
  try {
    payload = await request.json() as AttendancePayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const status = typeof payload.status === 'string' && ATTENDANCE_STATUSES.includes(payload.status as AttendanceStatus)
    ? payload.status as AttendanceStatus
    : null;
  const note = typeof payload.note === 'string' ? payload.note.trim() : '';

  if (!isUuid(payload.memberId) || !status || !memberMarkableStatuses.has(status)) {
    return Response.json(
      { error: 'A valid member and markable attendance status are required.' },
      { status: 400 },
    );
  }

  try {
    const result = await db.query<{
      id: string;
      member_id: string;
      attendance_date: string;
      status: string;
    }>(
      `INSERT INTO attendance_records (
         member_id, attendance_date, status, note, source
       )
       SELECT id, $2::date, $3, NULLIF($4, ''), 'MANUAL'
         FROM members
        WHERE id = $1 AND is_active
       ON CONFLICT (member_id, attendance_date) DO UPDATE
           SET status = EXCLUDED.status,
               note = EXCLUDED.note,
               updated_at = NOW()
         WHERE attendance_records.source = 'MANUAL'
       RETURNING id, member_id, attendance_date::text, status`,
      [payload.memberId, todayInIndia(), attendanceStatusValue(status), note],
    );

    if (!result.rows[0]) {
      const approvedLeave = await db.query(
        `SELECT 1 FROM attendance_records
          WHERE member_id = $1 AND attendance_date = $2 AND source = 'LEAVE_REQUEST'`,
        [payload.memberId, todayInIndia()],
      );
      return Response.json(
        { error: approvedLeave.rows[0]
          ? 'Today is controlled by approved leave and cannot be overwritten.'
          : 'Active member not found.' },
        { status: approvedLeave.rows[0] ? 409 : 404 },
      );
    }

    revalidatePath('/attendance');
    revalidatePath(`/members/${payload.memberId}`);
    revalidatePath('/departments');
    revalidatePath('/workload');
    return Response.json({ attendance: result.rows[0] });
  } catch (error) {
    console.error('Could not mark attendance:', error);
    return Response.json({ error: 'Could not mark attendance.' }, { status: 500 });
  }
}
