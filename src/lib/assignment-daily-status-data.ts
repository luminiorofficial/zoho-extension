import 'server-only';

import type { QueryResultRow } from 'pg';

import { db } from '@/lib/db';
import type { AssignmentDailyStatus, KeyAssignmentStatusCode } from '@/types';

interface DailyStatusRow extends QueryResultRow {
  id: string;
  assignment_id: string;
  work_date: string | Date;
  status: KeyAssignmentStatusCode;
  note: string | null;
  updated_at: string | Date;
  updated_by: string | null;
}

export interface AssignmentDailyStatusFilters {
  assignmentId?: string;
  assignmentIds?: string[];
  memberId?: string;
  startDate?: string;
  endDate?: string;
}

function dateString(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function timestampString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function toDailyStatus(row: DailyStatusRow): AssignmentDailyStatus {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    workDate: dateString(row.work_date),
    status: row.status,
    note: row.note ?? undefined,
    updatedAt: timestampString(row.updated_at),
    updatedBy: row.updated_by ?? undefined,
  };
}

export async function getAssignmentDailyStatuses(
  filters: AssignmentDailyStatusFilters = {},
): Promise<AssignmentDailyStatus[]> {
  if (filters.assignmentIds?.length === 0) return [];

  const result = await db.query<DailyStatusRow>(
    `SELECT ads.id, ads.assignment_id, ads.work_date, ads.status,
            ads.note, ads.updated_at, ads.updated_by
       FROM assignment_daily_status ads
       JOIN key_assignments ka ON ka.id = ads.assignment_id
      WHERE ($1::uuid IS NULL OR ads.assignment_id = $1)
        AND ($2::uuid IS NULL OR ka.member_id = $2)
        AND ($3::date IS NULL OR ads.work_date >= $3)
        AND ($4::date IS NULL OR ads.work_date <= $4)
        AND ($5::uuid[] IS NULL OR ads.assignment_id = ANY($5))
      ORDER BY ads.work_date DESC, ads.updated_at DESC`,
    [
      filters.assignmentId ?? null,
      filters.memberId ?? null,
      filters.startDate ?? null,
      filters.endDate ?? null,
      filters.assignmentIds ?? null,
    ],
  );

  return result.rows.map(toDailyStatus);
}

export async function upsertAssignmentDailyStatus(input: {
  assignmentId: string;
  workDate: string;
  status: KeyAssignmentStatusCode;
  note?: string | null;
  updatedBy?: string | null;
}): Promise<AssignmentDailyStatus> {
  const result = await db.query<DailyStatusRow>(
    `INSERT INTO assignment_daily_status (
       assignment_id, work_date, status, note, updated_by
     ) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (assignment_id, work_date)
     DO UPDATE SET
       status = EXCLUDED.status,
       note = EXCLUDED.note,
       updated_by = EXCLUDED.updated_by
     RETURNING id, assignment_id, work_date, status, note, updated_at, updated_by`,
    [
      input.assignmentId,
      input.workDate,
      input.status,
      input.note ?? null,
      input.updatedBy ?? null,
    ],
  );

  return toDailyStatus(result.rows[0]);
}
