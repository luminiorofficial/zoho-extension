import 'server-only';

import type { QueryResultRow } from 'pg';

import {
  attendanceStatusLabel,
  availabilityStatusLabel,
  leaveStatusLabel,
  todayInIndia,
} from '@/lib/attendance-utils';
import { db } from '@/lib/db';
import type {
  AttendanceRecord,
  AttendanceReviewer,
  AttendanceStatus,
  AttendanceSummary,
  DepartmentAttendanceMember,
  LeaveRequest,
} from '@/types';

interface AttendanceRow extends QueryResultRow {
  id: string;
  member_id: string;
  member_name: string;
  department_ids: string[];
  department_names: string[];
  attendance_date: string;
  status: string;
  note: string | null;
  source: string;
  is_read_only: boolean;
}

export interface AttendanceFilters {
  departmentId?: string;
  memberId?: string;
  from?: string;
  to?: string;
  status?: string;
}

export interface AttendanceOptionData {
  departments: { id: string; name: string }[];
  members: { id: string; name: string; departmentIds: string[] }[];
}

function mapAttendance(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    memberId: row.member_id,
    memberName: row.member_name,
    departmentIds: row.department_ids,
    departmentNames: row.department_names,
    date: row.attendance_date,
    status: attendanceStatusLabel(row.status),
    note: row.note ?? undefined,
    source: row.source === 'IMPORTED'
      ? 'Imported'
      : row.source === 'LEAVE_REQUEST' ? 'Leave request' : 'Manual',
    isReadOnly: row.is_read_only,
  };
}

export async function getAttendanceRecords(
  filters: AttendanceFilters = {},
): Promise<AttendanceRecord[]> {
  const result = await db.query<AttendanceRow>(
    `SELECT ah.id,
            ah.member_id,
            m.name AS member_name,
            ARRAY(
              SELECT dm.department_id
                FROM department_members dm
                JOIN departments d ON d.id = dm.department_id
               WHERE dm.member_id = m.id
               ORDER BY d.name, d.id
            ) AS department_ids,
            ARRAY(
              SELECT d.name
                FROM department_members dm
                JOIN departments d ON d.id = dm.department_id
               WHERE dm.member_id = m.id
               ORDER BY d.name, d.id
            ) AS department_names,
            ah.attendance_date::text,
            ah.status,
            ah.note,
            ah.source,
            ah.is_read_only
       FROM attendance_history ah
       JOIN members m ON m.id = ah.member_id
      WHERE ($1::uuid IS NULL OR EXISTS (
              SELECT 1 FROM department_members dm
               WHERE dm.member_id = ah.member_id AND dm.department_id = $1
            ))
        AND ($2::uuid IS NULL OR ah.member_id = $2)
        AND ($3::date IS NULL OR ah.attendance_date >= $3)
        AND ($4::date IS NULL OR ah.attendance_date <= $4)
        AND ($5::varchar IS NULL OR ah.status = $5)
      ORDER BY ah.attendance_date DESC, m.name, ah.id`,
    [
      filters.departmentId || null,
      filters.memberId || null,
      filters.from || null,
      filters.to || null,
      filters.status || null,
    ],
  );

  return result.rows.map(mapAttendance);
}

export async function getAttendanceOptions(): Promise<AttendanceOptionData> {
  const [departmentResult, memberResult] = await Promise.all([
    db.query<{ id: string; name: string }>(
      `SELECT id, name FROM departments WHERE is_active ORDER BY name`,
    ),
    db.query<{ id: string; name: string; department_ids: string[] }>(
      `SELECT m.id,
              m.name,
              ARRAY(
                SELECT dm.department_id
                  FROM department_members dm
                 WHERE dm.member_id = m.id
                 ORDER BY dm.department_id
              ) AS department_ids
         FROM members m
        WHERE m.is_active
        ORDER BY m.name`,
    ),
  ]);

  return {
    departments: departmentResult.rows,
    members: memberResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      departmentIds: row.department_ids,
    })),
  };
}

export async function getDepartmentAttendanceToday(
  departmentId: string,
): Promise<DepartmentAttendanceMember[]> {
  const result = await db.query<{
    member_id: string;
    member_name: string;
    role_title: string | null;
    status: string;
  }>(
    `SELECT m.id AS member_id,
            m.name AS member_name,
            m.role_title,
            COALESCE(ah.status, 'NOT_MARKED') AS status
       FROM department_members dm
       JOIN members m ON m.id = dm.member_id AND m.is_active
       LEFT JOIN attendance_history ah
         ON ah.member_id = m.id AND ah.attendance_date = $2
      WHERE dm.department_id = $1
      ORDER BY m.name`,
    [departmentId, todayInIndia()],
  );

  return result.rows.map((row) => ({
    memberId: row.member_id,
    memberName: row.member_name,
    role: row.role_title ?? '—',
    status: availabilityStatusLabel(row.status),
  }));
}

export async function getMemberAttendanceSummary(memberId: string): Promise<AttendanceSummary> {
  const history = await getAttendanceRecords({ memberId });
  const emptyCounts: Record<AttendanceStatus, number> = {
    Present: 0,
    'Half Day': 0,
    'Approved Leave': 0,
    Absent: 0,
    'Work on Holiday': 0,
  };
  const counts = history.reduce((totals, record) => {
    totals[record.status] += 1;
    return totals;
  }, emptyCounts);
  const todayStatus = history.find((record) => record.date === todayInIndia())?.status ?? 'Not Marked';

  return { todayStatus, counts, history };
}

export async function getLeaveRequests(filters: {
  memberId?: string;
  departmentId?: string;
} = {}): Promise<LeaveRequest[]> {
  const result = await db.query<{
    id: string;
    department_id: string;
    department_name: string;
    member_id: string;
    member_name: string;
    start_date: string;
    end_date: string;
    reason: string;
    status: string;
    reviewer_name: string | null;
    review_note: string | null;
    created_at: string;
  }>(
    `SELECT lr.id,
            lr.department_id,
            d.name AS department_name,
            lr.member_id,
            m.name AS member_name,
            lr.start_date::text,
            lr.end_date::text,
            lr.reason,
            lr.status,
            reviewer.name AS reviewer_name,
            lr.review_note,
            lr.created_at::text
       FROM leave_requests lr
       JOIN departments d ON d.id = lr.department_id
       JOIN members m ON m.id = lr.member_id
       LEFT JOIN members reviewer ON reviewer.id = lr.reviewed_by_member_id
      WHERE ($1::uuid IS NULL OR lr.member_id = $1)
        AND ($2::uuid IS NULL OR lr.department_id = $2)
      ORDER BY CASE lr.status WHEN 'PENDING' THEN 0 ELSE 1 END,
               lr.start_date DESC,
               lr.created_at DESC`,
    [filters.memberId || null, filters.departmentId || null],
  );

  return result.rows.map((row) => ({
    id: row.id,
    departmentId: row.department_id,
    departmentName: row.department_name,
    memberId: row.member_id,
    memberName: row.member_name,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    status: leaveStatusLabel(row.status),
    reviewerName: row.reviewer_name ?? undefined,
    reviewNote: row.review_note ?? undefined,
    createdAt: row.created_at,
  }));
}

export async function getAttendanceReviewers(): Promise<AttendanceReviewer[]> {
  const result = await db.query<{
    member_id: string;
    member_name: string;
    department_ids: string[];
    is_admin: boolean;
  }>(
    `SELECT m.id AS member_id,
            m.name AS member_name,
            ARRAY_AGG(dm.department_id ORDER BY dm.department_id)
              FILTER (WHERE dm.is_department_head) AS department_ids,
            (
              COALESCE(m.role_title ILIKE '%admin%', FALSE)
              OR BOOL_OR(COALESCE(UPPER(d.name) = 'ADMIN', FALSE))
            ) AS is_admin
       FROM members m
       LEFT JOIN department_members dm ON dm.member_id = m.id
       LEFT JOIN departments d ON d.id = dm.department_id
      WHERE m.is_active
      GROUP BY m.id, m.name, m.role_title
     HAVING BOOL_OR(COALESCE(dm.is_department_head, FALSE))
         OR COALESCE(m.role_title ILIKE '%admin%', FALSE)
         OR BOOL_OR(COALESCE(UPPER(d.name) = 'ADMIN', FALSE))
      ORDER BY m.name`,
  );

  return result.rows.map((row) => ({
    memberId: row.member_id,
    memberName: row.member_name,
    departmentIds: row.department_ids ?? [],
    isAdmin: row.is_admin,
  }));
}
