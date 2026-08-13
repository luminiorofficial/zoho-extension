import 'server-only';

import type { QueryResultRow } from 'pg';

import { db } from '@/lib/db';
import type {
  ActionStatus,
  DailyTask,
  DepartmentWorkData,
  MemberWorkData,
  PeriodProgress,
  PeriodType,
  Project,
  WeekGoal,
  WorkActionOption,
} from '@/types';

interface ProjectRow extends QueryResultRow {
  id: string;
  department_id: string;
  goal_id: string;
  goal_title: string;
  code: string | null;
  name: string;
  description: string | null;
  status: string;
  total_tasks: number;
  done_tasks: number;
  progress_percent: string;
}

interface WeekGoalRow extends QueryResultRow {
  id: string;
  title: string;
  description: string | null;
  week_start: string | Date;
  week_end: string | Date;
  action_id: string;
  action_title: string;
  project_id: string;
  project_name: string;
  assigned_member_id: string;
  assigned_member_name: string;
  total_tasks: number;
  done_tasks: number;
  progress_percent: string;
}

interface TaskRow extends QueryResultRow {
  id: string;
  week_goal_id: string;
  week_goal_title: string;
  action_id: string;
  action_title: string;
  project_id: string;
  project_name: string;
  assigned_member_id: string;
  task_date: string | Date;
  title: string;
  description: string | null;
  status: string;
}

interface PeriodProgressRow extends QueryResultRow {
  period_type: PeriodType;
  period_start: string | Date;
  period_end: string | Date;
  total_tasks: number;
  done_tasks: number;
  progress_percent: string;
}

interface WorkActionRow extends QueryResultRow {
  id: string;
  goal_id: string;
  goal_title: string;
  title: string;
  code: string | null;
}

function mapStatus(status: string): ActionStatus {
  if (status === 'DONE') return 'Done';
  if (status === 'IN_PROGRESS') return 'In Progress';
  return 'Not Started';
}

function dateString(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    departmentId: row.department_id,
    goalId: row.goal_id,
    goalTitle: row.goal_title,
    code: row.code ?? undefined,
    name: row.name,
    description: row.description ?? undefined,
    status: mapStatus(row.status),
    totalTasks: Number(row.total_tasks),
    doneTasks: Number(row.done_tasks),
    progress: Number(row.progress_percent),
  };
}

function mapTask(row: TaskRow): DailyTask {
  return {
    id: row.id,
    weekGoalId: row.week_goal_id,
    weekGoalTitle: row.week_goal_title,
    actionId: row.action_id,
    actionTitle: row.action_title,
    projectId: row.project_id,
    projectName: row.project_name,
    assignedMemberId: row.assigned_member_id,
    taskDate: dateString(row.task_date),
    title: row.title,
    description: row.description ?? undefined,
    status: mapStatus(row.status),
  };
}

async function getProjects(
  departmentId: string | null,
  memberId: string | null,
): Promise<Project[]> {
  const result = await db.query<ProjectRow>(
    `SELECT DISTINCT
            p.id,
            p.department_id,
            p.goal_id,
            g.title AS goal_title,
            p.code,
            p.name,
            p.description,
            CASE
              WHEN ptp.total_tasks IS NULL THEN p.status
              WHEN ptp.progress_percent = 100 THEN 'DONE'
              WHEN ptp.progress_percent > 0 THEN 'IN_PROGRESS'
              ELSE 'NOT_STARTED'
            END AS status,
            COALESCE(ptp.total_tasks, 0) AS total_tasks,
            COALESCE(ptp.done_tasks, 0) AS done_tasks,
            COALESCE(ptp.progress_percent, 0) AS progress_percent
       FROM projects p
       JOIN goals g ON g.id = p.goal_id
       LEFT JOIN project_task_progress ptp ON ptp.project_id = p.id
      WHERE ($1::uuid IS NULL OR p.department_id = $1)
        AND (
          $2::uuid IS NULL
          OR EXISTS (
            SELECT 1
              FROM actions a
              JOIN action_assignees aa ON aa.action_id = a.id
             WHERE a.goal_id = p.goal_id
               AND aa.member_id = $2
          )
        )
      ORDER BY g.title, p.name`,
    [departmentId, memberId],
  );

  return result.rows.map(mapProject);
}

async function getWeekGoals(
  departmentId: string | null,
  memberId: string | null,
): Promise<{ weekGoals: WeekGoal[]; tasks: DailyTask[] }> {
  const [weekGoalResult, taskResult] = await Promise.all([
    db.query<WeekGoalRow>(
      `SELECT wg.id,
              wg.title,
              wg.description,
              wg.week_start,
              (wg.week_start + 6) AS week_end,
              wg.action_id,
              a.title AS action_title,
              wg.project_id,
              p.name AS project_name,
              wg.assigned_member_id,
              m.name AS assigned_member_name,
              wgp.total_tasks,
              wgp.done_tasks,
              wgp.progress_percent
         FROM week_goals wg
         JOIN actions a ON a.id = wg.action_id
         JOIN projects p ON p.id = wg.project_id
         JOIN members m ON m.id = wg.assigned_member_id
         JOIN week_goal_progress wgp ON wgp.week_goal_id = wg.id
        WHERE ($1::uuid IS NULL OR wg.department_id = $1)
          AND ($2::uuid IS NULL OR wg.assigned_member_id = $2)
        ORDER BY wg.week_start DESC, m.name, wg.title`,
      [departmentId, memberId],
    ),
    db.query<TaskRow>(
      `SELECT t.id,
              t.week_goal_id,
              wg.title AS week_goal_title,
              t.action_id,
              a.title AS action_title,
              t.project_id,
              p.name AS project_name,
              t.assigned_member_id,
              t.task_date,
              t.title,
              t.description,
              t.status
         FROM tasks t
         JOIN week_goals wg ON wg.id = t.week_goal_id
         JOIN actions a ON a.id = t.action_id
         JOIN projects p ON p.id = t.project_id
        WHERE ($1::uuid IS NULL OR wg.department_id = $1)
          AND ($2::uuid IS NULL OR t.assigned_member_id = $2)
        ORDER BY t.task_date DESC, t.created_at DESC`,
      [departmentId, memberId],
    ),
  ]);

  const tasks = taskResult.rows.map(mapTask);
  const tasksByWeekGoal = new Map<string, DailyTask[]>();
  for (const task of tasks) {
    const existing = tasksByWeekGoal.get(task.weekGoalId);
    if (existing) existing.push(task);
    else tasksByWeekGoal.set(task.weekGoalId, [task]);
  }

  const weekGoals: WeekGoal[] = weekGoalResult.rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    weekStart: dateString(row.week_start),
    weekEnd: dateString(row.week_end),
    actionId: row.action_id,
    actionTitle: row.action_title,
    projectId: row.project_id,
    projectName: row.project_name,
    assignedMemberId: row.assigned_member_id,
    assignedMemberName: row.assigned_member_name,
    totalTasks: Number(row.total_tasks),
    doneTasks: Number(row.done_tasks),
    progress: Number(row.progress_percent),
    tasks: tasksByWeekGoal.get(row.id) ?? [],
  }));

  return { weekGoals, tasks };
}

async function getCurrentProgress(
  departmentId: string | null,
  memberId: string | null,
): Promise<PeriodProgress[]> {
  const result = await db.query<PeriodProgressRow>(
    `WITH current_periods AS (
       SELECT
         period_type,
         period_start,
         period_end
       FROM (VALUES
         (
           'WEEKLY'::varchar(30),
           DATE_TRUNC('week', CURRENT_DATE)::date,
           (DATE_TRUNC('week', CURRENT_DATE)::date + 6)
         ),
         (
           'MONTHLY'::varchar(30),
           DATE_TRUNC('month', CURRENT_DATE)::date,
           (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::date
         ),
         (
           'QUARTERLY'::varchar(30),
           (DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '3 months')
             + INTERVAL '3 months')::date,
           (DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '3 months')
             + INTERVAL '6 months - 1 day')::date
         ),
         (
           'YEARLY'::varchar(30),
           (DATE_TRUNC('year', CURRENT_DATE - INTERVAL '3 months')
             + INTERVAL '3 months')::date,
           (DATE_TRUNC('year', CURRENT_DATE - INTERVAL '3 months')
             + INTERVAL '15 months - 1 day')::date
         )
       ) AS value(period_type, period_start, period_end)
     )
     SELECT cp.period_type,
            cp.period_start,
            cp.period_end,
            COALESCE(SUM(tpp.total_tasks), 0)::integer AS total_tasks,
            COALESCE(SUM(tpp.done_tasks), 0)::integer AS done_tasks,
            COALESCE(
              ROUND(
                SUM(tpp.progress_percent * tpp.total_tasks)
                  / NULLIF(SUM(tpp.total_tasks), 0),
                2
              ),
              0
            ) AS progress_percent
       FROM current_periods cp
       LEFT JOIN task_period_progress tpp
         ON tpp.period_type = cp.period_type
        AND tpp.period_start = cp.period_start
        AND ($1::uuid IS NULL OR tpp.department_id = $1)
        AND ($2::uuid IS NULL OR tpp.member_id = $2)
      GROUP BY cp.period_type, cp.period_start, cp.period_end
      ORDER BY CASE cp.period_type
        WHEN 'WEEKLY' THEN 1
        WHEN 'MONTHLY' THEN 2
        WHEN 'QUARTERLY' THEN 3
        WHEN 'YEARLY' THEN 4
      END`,
    [departmentId, memberId],
  );

  return result.rows.map((row) => ({
    periodType: row.period_type,
    periodStart: dateString(row.period_start),
    periodEnd: dateString(row.period_end),
    totalTasks: Number(row.total_tasks),
    doneTasks: Number(row.done_tasks),
    progress: Number(row.progress_percent),
  }));
}

export async function getDepartmentWorkData(
  departmentId: string,
): Promise<DepartmentWorkData> {
  const [projects, execution, periodProgress] = await Promise.all([
    getProjects(departmentId, null),
    getWeekGoals(departmentId, null),
    getCurrentProgress(departmentId, null),
  ]);

  return {
    projects,
    weekGoals: execution.weekGoals,
    periodProgress,
  };
}

export async function getMemberWorkData(memberId: string): Promise<MemberWorkData> {
  const [projects, execution, periodProgress, actionResult] = await Promise.all([
    getProjects(null, memberId),
    getWeekGoals(null, memberId),
    getCurrentProgress(null, memberId),
    db.query<WorkActionRow>(
      `SELECT a.id,
              a.goal_id,
              g.title AS goal_title,
              a.title,
              a.code
         FROM actions a
         JOIN goals g ON g.id = a.goal_id
         JOIN action_assignees aa ON aa.action_id = a.id
        WHERE aa.member_id = $1
        ORDER BY g.title, a.code NULLS LAST, a.title`,
      [memberId],
    ),
  ]);

  const actions: WorkActionOption[] = actionResult.rows.map((row) => ({
    id: row.id,
    goalId: row.goal_id,
    goalTitle: row.goal_title,
    title: row.title,
    code: row.code ?? undefined,
  }));

  return {
    projects,
    actions,
    weekGoals: execution.weekGoals,
    tasks: execution.tasks,
    periodProgress,
  };
}
