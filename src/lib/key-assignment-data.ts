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
  UnifiedWorkReportItem,
  AssignmentReportingOption,
  ReportingOption,
  TaskMasterItem,
} from '@/types';
import { getUnifiedWorkReport } from '@/lib/unified-work-report';

export interface KeyAssignmentReportOptions {
  departments: ReportingOption[];
  teams: ReportingOption[];
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
  const [departments, teams, projects, members, keys, subGoals, tasks] = await Promise.all([
    db.query<QueryResultRow & { id: string; name: string }>(
      `SELECT DISTINCT d.id, d.name
         FROM key_assignments ka
         JOIN members m ON m.id = ka.member_id
         JOIN departments d ON d.id = m.current_department_id
        ORDER BY d.name`,
    ),
    db.query<QueryResultRow & { id: string; name: string }>(
      `SELECT DISTINCT m.team AS id, m.team AS name
         FROM key_assignments ka
         JOIN members m ON m.id = ka.member_id
        WHERE m.team IS NOT NULL
        ORDER BY m.team`,
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
    teams: teams.rows,
    projects: projects.rows.map((row) => ({ id: row.id, name: row.name, departmentId: row.department_id })),
    members: members.rows,
    keys: keys.rows,
    subGoals: subGoals.rows.map((row) => ({ id: row.id, name: row.name, keyId: row.key_id })),
    tasks: tasks.rows,
  };
}

export function toKeyAssignment(
  row: UnifiedWorkReportItem,
): KeyAssignment {
  return {
    id: row.id,
    keyId: row.key.id,
    keyCode: row.key.code,
    keyTitle: row.key.title,
    subGoalId: row.subGoal.id,
    subGoalTitle: row.subGoal.title,
    projectId: row.project.id,
    projectName: row.project.name,
    departmentId: row.project.departmentId,
    departmentName: row.project.departmentName,
    taskId: row.task.id,
    taskCategory: row.task.category,
    taskTitle: row.task.title,
    memberId: row.member.id,
    memberName: row.member.name,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    dailyStatuses: row.dailyStatuses,
  };
}

// Compatibility wrapper for assignment-management pages. It contains no SQL;
// every read still runs through getUnifiedWorkReport.
export async function getKeyAssignments(
  filters: KeyAssignmentFilters,
): Promise<KeyAssignment[]> {
  const rows = await getUnifiedWorkReport(filters);
  return rows.map(toKeyAssignment);
}
