import 'server-only';

import type { QueryResultRow } from 'pg';

import { db } from '@/lib/db';
import type {
  AssignmentKeyCode,
  KeyAssignmentStatus,
  UnifiedWorkReportItem,
  UnifiedWorkReportFilters,
} from '@/types';

interface UnifiedWorkReportRow extends QueryResultRow {
  id: string;
  key_id: string;
  key_code: AssignmentKeyCode;
  key_title: string;
  sub_goal_id: string;
  sub_goal_title: string;
  project_id: string;
  project_name: string;
  department_id: string;
  department_name: string;
  task_id: string;
  task_category: string;
  task_title: string;
  member_id: string;
  member_name: string;
  start_date: string | Date;
  end_date: string | Date;
  status: string;
}

function dateString(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function reportStatus(status: string): KeyAssignmentStatus {
  if (status === 'DONE') return 'Done';
  if (status === 'IN_PROGRESS') return 'In Progress';
  if (status === 'ON_HOLD') return 'On Hold';
  if (status === 'CANCELLED') return 'Cancelled';
  return 'Not Started';
}

function databaseStatus(status?: KeyAssignmentStatus): string | null {
  return status?.toUpperCase().replaceAll(' ', '_') ?? null;
}

/**
 * The shared read model for Key -> Sub Goal -> Project -> Task -> Member work.
 * Date filters use overlap semantics, so an assignment is included when any
 * part of its start/end range falls inside the requested range.
 */
export async function getUnifiedWorkReport(
  filters: UnifiedWorkReportFilters = {},
): Promise<UnifiedWorkReportItem[]> {
  const result = await db.query<UnifiedWorkReportRow>(
    `
    SELECT
      ka.id,
      ka.key_id, ak.code AS key_code, ak.title AS key_title,
      ka.sub_goal_id, sg.title AS sub_goal_title,
      ka.project_id, p.name AS project_name,
      p.department_id, d.name AS department_name,
      ka.task_id, tm.category AS task_category, tm.title AS task_title,
      ka.member_id, m.name AS member_name,
      ka.start_date, ka.end_date, ka.status

    FROM key_assignments ka
    JOIN assignment_keys ak ON ak.id = ka.key_id
    JOIN assignment_sub_goals sg ON sg.id = ka.sub_goal_id
    JOIN projects p ON p.id = ka.project_id
    JOIN departments d ON d.id = p.department_id
    JOIN task_master tm ON tm.id = ka.task_id
    JOIN members m ON m.id = ka.member_id

    WHERE ($1::uuid IS NULL OR ka.key_id = $1)
      AND ($2::uuid IS NULL OR ka.sub_goal_id = $2)
      AND ($3::uuid IS NULL OR ka.project_id = $3)
      AND ($4::uuid IS NULL OR ka.task_id = $4)
      AND ($5::uuid IS NULL OR ka.member_id = $5)
      AND ($6::varchar IS NULL OR ka.status = $6)
      AND ($7::date IS NULL OR ka.end_date >= $7)
      AND ($8::date IS NULL OR ka.start_date <= $8)
      AND ($9::uuid IS NULL OR p.department_id = $9)

    ORDER BY ka.start_date DESC, d.name, p.name, m.name
    `,
    [
      filters.keyId ?? null,
      filters.subGoalId ?? null,
      filters.projectId ?? null,
      filters.taskId ?? null,
      filters.memberId ?? null,
      databaseStatus(filters.status),
      filters.startDate ?? null,
      filters.endDate ?? null,
      filters.departmentId ?? null,
    ],
  );

  return result.rows.map((row) => ({
    id: row.id,
    key: {
      id: row.key_id,
      code: row.key_code,
      title: row.key_title,
    },
    subGoal: {
      id: row.sub_goal_id,
      title: row.sub_goal_title,
    },
    project: {
      id: row.project_id,
      name: row.project_name,
      departmentId: row.department_id,
      departmentName: row.department_name,
    },
    task: {
      id: row.task_id,
      category: row.task_category,
      title: row.task_title,
    },
    member: {
      id: row.member_id,
      name: row.member_name,
    },
    startDate: dateString(row.start_date),
    endDate: dateString(row.end_date),
    status: reportStatus(row.status),
  }));
}
