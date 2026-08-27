import 'server-only';

import type { QueryResultRow } from 'pg';

import { db } from '@/lib/db';
import type {
  ActionStatus,
  AssignableProject,
  AssignmentKey,
  AssignmentKeyCode,
  AssignmentSubGoal,
  KeyAssignment,
  KeyAssignmentFilters,
  TaskMasterItem,
} from '@/types';

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

function mapStatus(status: string): ActionStatus {
  if (status === 'DONE') return 'Done';
  if (status === 'IN_PROGRESS') return 'In Progress';
  if (status === 'ON_HOLD') return 'On Hold';
  if (status === 'CANCELLED') return 'Cancelled';
  return 'Not Started';
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
    subGoals: row.sub_goals,
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
      AND ($5::date IS NULL OR ka.end_date >= $5)
      AND ($6::date IS NULL OR ka.start_date <= $6)

    ORDER BY ka.start_date DESC, d.name, p.name, m.name
    `,
    [
      filters.departmentId ?? null,
      filters.projectId ?? null,
      filters.memberId ?? null,
      filters.keyId ?? null,
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
