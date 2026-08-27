import 'server-only';

import type { QueryResultRow } from 'pg';

import { db } from '@/lib/db';
import type {
  AssignableMember,
  AssignableProject,
  AssignmentKey,
  AssignmentKeyCode,
  KeyAssignment,
  KeyAssignmentFilters,
  KeyAssignmentStatus,
  AssignmentReportingOption,
  ReportingOption,
  TaskMasterItem,
} from '@/types';

export interface KeyAssignmentReportOptions {
  departments: ReportingOption[];
  projects: ReportingOption[];
  members: ReportingOption[];
  keys: ReportingOption[];
  subGoals: AssignmentReportingOption[];
  tasks: ReportingOption[];
}

interface AssignmentKeyRow extends QueryResultRow {
  id: string;
  code: AssignmentKeyCode;
  title: string;
  sub_goals: {
    id: string;
    keyId: string;
    title: string;
    description: string | null;
    isActive: boolean;
  }[];
}

interface TaskMasterRow extends QueryResultRow {
  id: string;
  category: string;
  title: string;
  is_active: boolean;
}

interface AssignableProjectRow extends QueryResultRow {
  id: string;
  name: string;
  department_id: string;
  department_name: string;
}

interface KeyAssignmentRow extends QueryResultRow {
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

function mapStatus(status: string): KeyAssignmentStatus {
  if (status === 'DONE') return 'Done';
  if (status === 'IN_PROGRESS') return 'In Progress';
  if (status === 'ON_HOLD') return 'On Hold';
  if (status === 'CANCELLED') return 'Cancelled';
  return 'Not Started';
}

function databaseStatus(status?: KeyAssignmentStatus): string | null {
  if (!status) return null;
  return status.toUpperCase().replaceAll(' ', '_');
}

export async function getAssignmentKeys(): Promise<AssignmentKey[]> {
  const result = await db.query<AssignmentKeyRow>(
    `
    SELECT
      ak.id,
      ak.code,
      ak.title,

      COALESCE(
        (
          SELECT JSONB_AGG(
            JSONB_BUILD_OBJECT(
              'id', sg.id,
              'keyId', sg.key_id,
              'title', sg.title,
              'description', sg.description,
              'isActive', sg.is_active
            )
            ORDER BY sg.title
          )
          FROM assignment_sub_goals sg
          WHERE sg.key_id = ak.id
        ),
        '[]'::jsonb
      ) AS sub_goals

    FROM assignment_keys ak
    ORDER BY ak.code
    `,
  );

  return result.rows.map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    subGoals: row.sub_goals.map((subGoal) => ({
      ...subGoal,
      description: subGoal.description ?? undefined,
    })),
  }));
}

export async function getTaskMasterItems(): Promise<TaskMasterItem[]> {
  const result = await db.query<TaskMasterRow>(
    `
    SELECT id, category, title, is_active
      FROM task_master
     ORDER BY category, title
    `,
  );

  return result.rows.map((row) => ({
    id: row.id,
    category: row.category,
    title: row.title,
    isActive: row.is_active,
  }));
}

export async function getActiveProjectsForAssignment(): Promise<AssignableProject[]> {
  const result = await db.query<AssignableProjectRow>(
    `
    SELECT p.id, p.name, p.department_id, d.name AS department_name
      FROM projects p
      JOIN departments d ON d.id = p.department_id
     WHERE p.is_active = TRUE
     ORDER BY p.name
    `,
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    departmentId: row.department_id,
    departmentName: row.department_name,
  }));
}

export async function getActiveMembersForAssignment(): Promise<AssignableMember[]> {
  const result = await db.query<QueryResultRow & { id: string; name: string }>(
    `SELECT id, name
       FROM members
      WHERE is_active = TRUE
      ORDER BY name`,
  );

  return result.rows;
}

export async function getKeyAssignmentReportOptions(): Promise<KeyAssignmentReportOptions> {
  const [departments, projects, members, keys, subGoals, tasks] = await Promise.all([
    db.query<QueryResultRow & { id: string; name: string }>(
      `SELECT DISTINCT d.id, d.name
         FROM key_assignments ka
         JOIN projects p ON p.id = ka.project_id
         JOIN departments d ON d.id = p.department_id
        ORDER BY d.name`,
    ),
    db.query<QueryResultRow & { id: string; name: string; department_id: string }>(
      `SELECT DISTINCT p.id, p.name, p.department_id
         FROM key_assignments ka
         JOIN projects p ON p.id = ka.project_id
        ORDER BY p.name`,
    ),
    db.query<QueryResultRow & { id: string; name: string }>(
      `SELECT DISTINCT m.id, m.name
         FROM key_assignments ka
         JOIN members m ON m.id = ka.member_id
        ORDER BY m.name`,
    ),
    db.query<QueryResultRow & { id: string; name: string }>(
      `SELECT id, REPLACE(code, '_', ' ') AS name
         FROM assignment_keys
        ORDER BY code`,
    ),
    db.query<QueryResultRow & { id: string; name: string; key_id: string }>(
      `SELECT DISTINCT sg.id, sg.title AS name, sg.key_id
         FROM key_assignments ka
         JOIN assignment_sub_goals sg ON sg.id = ka.sub_goal_id
        ORDER BY sg.title`,
    ),
    db.query<QueryResultRow & { id: string; name: string }>(
      `SELECT DISTINCT tm.id, tm.title AS name
         FROM key_assignments ka
         JOIN task_master tm ON tm.id = ka.task_id
        ORDER BY tm.title`,
    ),
  ]);

  return {
    departments: departments.rows,
    projects: projects.rows.map((row) => ({ id: row.id, name: row.name, departmentId: row.department_id })),
    members: members.rows,
    keys: keys.rows,
    subGoals: subGoals.rows.map((row) => ({ id: row.id, name: row.name, keyId: row.key_id })),
    tasks: tasks.rows,
  };
}

export async function getKeyAssignments(filters: KeyAssignmentFilters): Promise<KeyAssignment[]> {
  const result = await db.query<KeyAssignmentRow>(
    `
    SELECT
      ka.id,
      ka.key_id, ak.code AS key_code, ak.title AS key_title,
      ka.sub_goal_id, sg.title AS sub_goal_title,
      ka.project_id, p.name AS project_name, p.department_id, d.name AS department_name,
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

    WHERE ($1::uuid IS NULL OR p.department_id = $1)
      AND ($2::uuid IS NULL OR ka.project_id = $2)
      AND ($3::uuid IS NULL OR ka.member_id = $3)
      AND ($4::uuid IS NULL OR ka.key_id = $4)
      AND ($5::uuid IS NULL OR ka.sub_goal_id = $5)
      AND ($6::uuid IS NULL OR ka.task_id = $6)
      AND ($7::varchar IS NULL OR ka.status = $7)
      AND ($8::date IS NULL OR ka.end_date >= $8)
      AND ($9::date IS NULL OR ka.start_date <= $9)

    ORDER BY ka.start_date DESC, d.name, p.name, m.name
    `,
    [
      filters.departmentId ?? null,
      filters.projectId ?? null,
      filters.memberId ?? null,
      filters.keyId ?? null,
      filters.subGoalId ?? null,
      filters.taskId ?? null,
      databaseStatus(filters.status),
      filters.periodStart ?? null,
      filters.periodEnd ?? null,
    ],
  );

  return result.rows.map((row) => ({
    id: row.id,
    keyId: row.key_id,
    keyCode: row.key_code,
    keyTitle: row.key_title,
    subGoalId: row.sub_goal_id,
    subGoalTitle: row.sub_goal_title,
    projectId: row.project_id,
    projectName: row.project_name,
    departmentId: row.department_id,
    departmentName: row.department_name,
    taskId: row.task_id,
    taskCategory: row.task_category,
    taskTitle: row.task_title,
    memberId: row.member_id,
    memberName: row.member_name,
    startDate: dateString(row.start_date),
    endDate: dateString(row.end_date),
    status: mapStatus(row.status),
  }));
}
