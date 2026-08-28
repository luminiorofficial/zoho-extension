import 'server-only';

import type { QueryResultRow } from 'pg';

import { db } from './db';
import { reportingPeriod } from './reporting-periods';
import { getUnifiedWorkReport } from './unified-work-report';
import { toKeyAssignment } from './key-assignment-data';
import type {
  KpiReportRow,
  PeriodReview,
  ReportingData,
  ReportingFilters,
  ReportingOption,
  AssignmentKeyCode,
} from '@/types';

interface TaskSummaryRow extends QueryResultRow {
  total_tasks: number;
  done_tasks: number;
  progress_percent: string;
}

interface KpiRow extends QueryResultRow {
  target_id: string;
  measurement_id: string | null;
  department_id: string;
  department_name: string;
  goal_id: string;
  goal_title: string;
  member_id: string | null;
  title: string;
  target_value: string | null;
  target_unit: string | null;
  achieved_value: string | null;
  progress_percent: string | null;
  note: string | null;
}

interface ReviewRow extends QueryResultRow {
  id: string;
  department_id: string | null;
  department_name: string | null;
  member_id: string | null;
  member_name: string | null;
  goal_id: string | null;
  goal_title: string | null;
  period_type: ReportingFilters['periodType'];
  period_start: string;
  period_end: string;
  score: string | null;
  summary: string | null;
  achievements: string | null;
  challenges: string | null;
  next_steps: string | null;
  source_sheet: string | null;
}

export async function getReportingData(filters: ReportingFilters): Promise<ReportingData> {
  const period = reportingPeriod(filters.periodType, filters.periodDate);
  if (!period) throw new Error('Invalid reporting period.');
  const departmentId = filters.departmentId ?? null;
  const memberId = filters.memberId ?? null;
  const goalId = filters.goalId ?? null;
  const assignmentStart = filters.assignmentStartDate ?? period.start;
  const assignmentEnd = filters.assignmentEndDate ?? period.end;

  const [
    departmentResult,
    memberResult,
    goalResult,
    taskResult,
    kpiResult,
    reviewResult,
    projectResult,
    assignmentKeyResult,
    assignmentSubGoalResult,
    assignmentTaskResult,
    unifiedWorkReport,
  ] = await Promise.all([
    db.query<QueryResultRow & { id: string; name: string }>(
      `SELECT id, name FROM departments WHERE is_active ORDER BY name`,
    ),
    db.query<QueryResultRow & { id: string; name: string; department_id: string }>(
      `SELECT m.id, m.name, dm.department_id
         FROM members m
         JOIN department_members dm ON dm.member_id = m.id
        WHERE m.is_active
        ORDER BY m.name`,
    ),
    db.query<QueryResultRow & { id: string; name: string; department_id: string }>(
      `SELECT id, title AS name, department_id
         FROM goals
        WHERE is_active
        ORDER BY title`,
    ),
    db.query<TaskSummaryRow>(
      `SELECT COALESCE(SUM(total_tasks), 0)::integer AS total_tasks,
              COALESCE(SUM(done_tasks), 0)::integer AS done_tasks,
              COALESCE(
                ROUND(SUM(progress_percent * total_tasks) / NULLIF(SUM(total_tasks), 0), 2),
                0
              ) AS progress_percent
         FROM task_period_progress
        WHERE period_type = $1
          AND period_start = $2::date
          AND ($3::uuid IS NULL OR department_id = $3)
          AND ($4::uuid IS NULL OR member_id = $4)
          AND ($5::uuid IS NULL OR goal_id = $5)`,
      [period.type, period.start, departmentId, memberId, goalId],
    ),
    db.query<KpiRow>(
      `SELECT t.id AS target_id,
              tmp.id AS measurement_id,
              g.department_id,
              d.name AS department_name,
              g.id AS goal_id,
              g.title AS goal_title,
              tmp.member_id,
              t.title,
              t.target_value,
              t.target_unit,
              tmp.achieved_value,
              tmp.progress_percent,
              tmp.note
         FROM targets t
         JOIN goals g ON g.id = t.goal_id
         JOIN departments d ON d.id = g.department_id
         LEFT JOIN target_measurement_progress tmp
           ON tmp.target_id = t.id
          AND tmp.period_type = $1
          AND tmp.period_start = $2::date
          AND tmp.period_end = $3::date
          AND tmp.member_id IS NOT DISTINCT FROM $5::uuid
        WHERE t.target_value IS NOT NULL
          AND t.target_value > 0
          AND (t.period_type = $1 OR t.period_type IS NULL OR tmp.id IS NOT NULL)
          AND ($4::uuid IS NULL OR g.department_id = $4)
          AND ($6::uuid IS NULL OR g.id = $6)
          AND (t.is_active OR tmp.id IS NOT NULL)
        ORDER BY d.name, g.title, t.title`,
      [period.type, period.start, period.end, departmentId, memberId, goalId],
    ),
    db.query<ReviewRow>(
      `SELECT pr.id,
              pr.department_id,
              d.name AS department_name,
              pr.member_id,
              m.name AS member_name,
              pr.goal_id,
              g.title AS goal_title,
              pr.period_type,
              pr.period_start::text,
              pr.period_end::text,
              pr.score,
              pr.summary,
              pr.achievements,
              pr.challenges,
              pr.next_steps,
              pr.source_sheet
         FROM period_reviews pr
         LEFT JOIN departments d ON d.id = pr.department_id
         LEFT JOIN members m ON m.id = pr.member_id
         LEFT JOIN goals g ON g.id = pr.goal_id
        WHERE pr.period_type = $1
          AND pr.period_start = $2::date
          AND ($3::uuid IS NULL OR pr.department_id = $3)
          AND ($4::uuid IS NULL OR pr.member_id = $4)
          AND ($5::uuid IS NULL OR pr.goal_id = $5)
        ORDER BY pr.updated_at DESC, pr.created_at DESC`,
      [period.type, period.start, departmentId, memberId, goalId],
    ),
    db.query<QueryResultRow & { id: string; name: string; department_id: string }>(
      `SELECT id, name, department_id
         FROM projects
        WHERE is_active
        ORDER BY name`,
    ),
    db.query<QueryResultRow & { id: string; code: AssignmentKeyCode; name: string }>(
      `SELECT id, code, REPLACE(code, '_', ' ') || ': ' || title AS name
         FROM assignment_keys
        ORDER BY code`,
    ),
    db.query<QueryResultRow & { id: string; name: string; key_id: string }>(
      `SELECT id, title AS name, key_id
         FROM assignment_sub_goals
        ORDER BY title`,
    ),
    db.query<QueryResultRow & { id: string; name: string }>(
      `SELECT id, title AS name
         FROM task_master
        ORDER BY title`,
    ),
    getUnifiedWorkReport({
      departmentId: filters.departmentId,
      projectId: filters.projectId,
      memberId: filters.memberId,
      keyId: filters.keyId,
      subGoalId: filters.subGoalId,
      taskId: filters.taskId,
      status: filters.assignmentStatus,
      startDate: assignmentStart,
      endDate: assignmentEnd,
    }),
  ]);

  const kpis: KpiReportRow[] = kpiResult.rows.map((row) => ({
    targetId: row.target_id,
    measurementId: row.measurement_id ?? undefined,
    departmentId: row.department_id,
    departmentName: row.department_name,
    goalId: row.goal_id,
    goalTitle: row.goal_title,
    memberId: row.member_id ?? undefined,
    title: row.title,
    targetValue: row.target_value === null ? undefined : Number(row.target_value),
    targetUnit: row.target_unit ?? undefined,
    achievedValue: row.achieved_value === null ? undefined : Number(row.achieved_value),
    progress: row.progress_percent === null ? undefined : Number(row.progress_percent),
    note: row.note ?? undefined,
  }));
  const measuredKpis = kpis.filter((kpi) => kpi.progress !== undefined);
  const kpiProgress = measuredKpis.length
    ? measuredKpis.reduce((sum, kpi) => sum + (kpi.progress ?? 0), 0) / measuredKpis.length
    : 0;
  const task = taskResult.rows[0];

  const departments: ReportingOption[] = departmentResult.rows.map((row) => ({ id: row.id, name: row.name }));
  const members: ReportingOption[] = memberResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    departmentId: row.department_id,
  }));
  const goals: ReportingOption[] = goalResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    departmentId: row.department_id,
  }));
  const projects: ReportingOption[] = projectResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    departmentId: row.department_id,
  }));
  const reviews: PeriodReview[] = reviewResult.rows.map((row) => ({
    id: row.id,
    departmentId: row.department_id ?? undefined,
    departmentName: row.department_name ?? undefined,
    memberId: row.member_id ?? undefined,
    memberName: row.member_name ?? undefined,
    goalId: row.goal_id ?? undefined,
    goalTitle: row.goal_title ?? undefined,
    periodType: row.period_type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    score: row.score === null ? undefined : Number(row.score),
    summary: row.summary ?? undefined,
    achievements: row.achievements ?? undefined,
    challenges: row.challenges ?? undefined,
    nextSteps: row.next_steps ?? undefined,
    isImported: row.source_sheet !== null,
  }));

  return {
    filters,
    periodStart: period.start,
    periodEnd: period.end,
    departments,
    members,
    goals,
    projects,
    assignmentKeys: assignmentKeyResult.rows.map((row) => ({ id: row.id, name: row.name })),
    assignmentSubGoals: assignmentSubGoalResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      keyId: row.key_id,
    })),
    assignmentTasks: assignmentTaskResult.rows.map((row) => ({ id: row.id, name: row.name })),
    taskProgress: {
      totalTasks: Number(task?.total_tasks ?? 0),
      doneTasks: Number(task?.done_tasks ?? 0),
      progress: Number(task?.progress_percent ?? 0),
    },
    kpis,
    kpiProgress,
    reviews,
    keyAssignments: unifiedWorkReport.map(toKeyAssignment),
  };
}
