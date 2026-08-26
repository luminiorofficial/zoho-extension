import fs from 'node:fs';
import path from 'node:path';

import { Pool, type PoolClient } from 'pg';

import { getCapacityStatus } from '../src/lib/capacity';
import { isBusinessDayInWeek, isoWeekStart, textValue } from '../src/lib/planner-validation';
import { reportingPeriod } from '../src/lib/reporting-periods';
import { nonNegativeNumber, optionalScore } from '../src/lib/reporting-validation';
import { MEMBER_WORKLOAD_QUERY } from '../src/lib/workload-query';

function loadLocalEnvironment(): void {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2');
    process.env[match[1]] = value;
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function expectConstraintFailure(
  client: PoolClient,
  savepoint: string,
  query: string,
  values: unknown[],
  expectedCode = '23514',
): Promise<void> {
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    await client.query(query, values);
    throw new Error(`Expected constraint failure at ${savepoint}.`);
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    assert(
      typeof error === 'object' && error !== null && 'code' in error && error.code === expectedCode,
      `Expected PostgreSQL error ${expectedCode} at ${savepoint}.`,
    );
  }
}

async function run(): Promise<void> {
  loadLocalEnvironment();
  assert(process.env.DATABASE_URL, 'DATABASE_URL is required for database tests.');
  assert(isoWeekStart('2026-08-14') === '2026-08-10', 'Week validation must normalize to Monday.');
  assert(isBusinessDayInWeek('2026-08-14', '2026-08-10'), 'Friday must be a valid work-plan day.');
  assert(!isBusinessDayInWeek('2026-08-15', '2026-08-10'), 'Saturday must not be a work-plan day.');
  assert(textValue('x'.repeat(501), 500) === null, 'Planning titles over 500 characters must be rejected.');
  assert(reportingPeriod('QUARTERLY', '2026-02-10')?.start === '2026-01-01', 'Financial Q4 must start in January.');
  assert(reportingPeriod('YEARLY', '2026-02-10')?.start === '2025-04-01', 'Financial year must run from April to March.');
  assert(reportingPeriod('YEARLY', '2026-04-01')?.end === '2027-03-31', 'April must start a new financial year.');
  assert(nonNegativeNumber('-1') === undefined, 'Negative KPI achievement must fail API validation.');
  assert(nonNegativeNumber('') === undefined, 'Blank KPI achievement must fail API validation.');
  assert(optionalScore('100.01') === undefined, 'Evaluation score over 100 must fail API validation.');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 1,
  });
  const client = await pool.connect();
  const schema = `project_test_${Date.now()}`;

  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET LOCAL search_path TO ${schema}`);

    for (const migration of [
      '001_init.sql',
      '002_work_planning.sql',
      '003_financial_year_progress.sql',
      '004_project_management_closure.sql',
      '005_attendance_leave.sql',
      '006_structure_crud.sql',
      '007_employee_workflow.sql',
      '008_kpi_evaluations.sql',
      '009_excel_migration_provenance.sql',
      '010_historical_progress_reporting.sql',
    ]) {
      await client.query(fs.readFileSync(path.join(process.cwd(), 'database', migration), 'utf8'));
    }

    const department = await client.query<{ id: string }>(
      `INSERT INTO departments (name) VALUES ('Project Test Department') RETURNING id`,
    );
    const members = await client.query<{ id: string }>(
      `INSERT INTO members (name, email) VALUES
         ('Project Owner', 'project-owner@test.invalid'),
         ('Project Member', 'project-member@test.invalid')
       RETURNING id`,
    );
    const departmentId = department.rows[0].id;
    const ownerId = members.rows[0].id;
    const memberId = members.rows[1].id;
    await client.query(
      `INSERT INTO department_members (department_id, member_id)
       VALUES ($1, $2), ($1, $3)`,
      [departmentId, ownerId, memberId],
    );
    await client.query(
      `UPDATE department_members SET is_department_head = TRUE
        WHERE department_id = $1 AND member_id = $2`,
      [departmentId, ownerId],
    );

    await client.query(
      `INSERT INTO daily_updates (
         department_id, member_id, update_date, activity, status, entry_type,
         source_sheet, source_row, source_cell
       ) VALUES
         ($1, $2, '2026-07-01', 'Approved leave', 'LEAVE', 'LEAVE', 'Import', 10, 'A10'),
         ($1, $2, '2026-07-01', 'Duplicate tracking row', 'LEAVE', 'LEAVE', 'Import', 10, 'B10'),
         ($1, $2, '2026-07-02', 'Work on Holiday', NULL, 'HOLIDAY', 'Import', 10, 'C10')`,
      [departmentId, memberId],
    );
    const importedAttendance = await client.query<{
      attendance_date: string;
      status: string;
      is_read_only: boolean;
    }>(
      `SELECT attendance_date::text, status, is_read_only
         FROM attendance_history
        WHERE member_id = $1
        ORDER BY attendance_date`,
      [memberId],
    );
    assert(importedAttendance.rows.length === 2, 'Imported daily tracking must collapse to one attendance row per date.');
    assert(importedAttendance.rows[0].status === 'APPROVED_LEAVE', 'Imported leave must map to approved leave history.');
    assert(importedAttendance.rows[0].is_read_only, 'Imported attendance history must be read-only.');
    assert(importedAttendance.rows[1].status === 'WORK_ON_HOLIDAY', 'Imported holiday work must retain its attendance status.');

    await client.query(
      `INSERT INTO attendance_records (member_id, attendance_date, status, source)
       VALUES ($1, '2026-08-10', 'PRESENT', 'MANUAL')
       ON CONFLICT (member_id, attendance_date) DO UPDATE SET status = EXCLUDED.status`,
      [memberId],
    );
    const leaveRequest = await client.query<{ id: string }>(
      `INSERT INTO leave_requests (
         department_id, member_id, start_date, end_date, reason
       ) VALUES ($1, $2, '2026-08-10', '2026-08-12', 'Database test leave')
       RETURNING id`,
      [departmentId, memberId],
    );
    await client.query(
      `UPDATE leave_requests
          SET status = 'APPROVED', reviewed_by_member_id = $2, reviewed_at = NOW()
        WHERE id = $1`,
      [leaveRequest.rows[0].id, ownerId],
    );
    const approvedAttendance = await client.query<{
      count: number;
      leave_days: number;
      source_days: number;
    }>(
      `SELECT COUNT(*)::integer AS count,
              COUNT(*) FILTER (WHERE status = 'APPROVED_LEAVE')::integer AS leave_days,
              COUNT(*) FILTER (
                WHERE source = 'LEAVE_REQUEST' AND leave_request_id = $2
              )::integer AS source_days
         FROM attendance_records
        WHERE member_id = $1
          AND attendance_date BETWEEN '2026-08-10' AND '2026-08-12'`,
      [memberId, leaveRequest.rows[0].id],
    );
    assert(approvedAttendance.rows[0].count === 3, 'Approved leave must create one attendance row per requested date.');
    assert(approvedAttendance.rows[0].leave_days === 3, 'Approved leave must set the full range to approved leave.');
    assert(approvedAttendance.rows[0].source_days === 3, 'Approved attendance must retain its leave request source.');
    const goal = await client.query<{ id: string }>(
      `INSERT INTO goals (department_id, title) VALUES ($1, 'Project Test Goal') RETURNING id`,
      [departmentId],
    );
    const action = await client.query<{ id: string }>(
      `INSERT INTO actions (goal_id, title) VALUES ($1, 'Project Test Action') RETURNING id`,
      [goal.rows[0].id],
    );
    const target = await client.query<{ id: string }>(
      `INSERT INTO targets (goal_id, title, target_value, target_unit, period_type)
       VALUES ($1, 'Project Test Target', 10, 'items', 'MONTHLY') RETURNING id`,
      [goal.rows[0].id],
    );

    await client.query(
      `INSERT INTO target_measurements (
         target_id, member_id, period_type, period_start, period_end, achieved_value, note
       ) VALUES ($1, $2, 'MONTHLY', '2026-08-01', '2026-08-31', 7.5, 'First measurement')`,
      [target.rows[0].id, memberId],
    );
    const measurementProgress = await client.query<{ progress_percent: string }>(
      `SELECT progress_percent
         FROM target_measurement_progress
        WHERE target_id = $1 AND member_id = $2`,
      [target.rows[0].id, memberId],
    );
    assert(Number(measurementProgress.rows[0].progress_percent) === 75, 'KPI progress must calculate achieved divided by target.');
    await client.query(
      `INSERT INTO target_measurements (
         target_id, member_id, period_type, period_start, period_end, achieved_value, note
       ) VALUES ($1, $2, 'MONTHLY', '2026-08-01', '2026-08-31', 8, 'Updated measurement')
       ON CONFLICT (
         target_id,
         (COALESCE(member_id, '00000000-0000-0000-0000-000000000000'::uuid)),
         period_type,
         period_start,
         period_end
       ) DO UPDATE SET achieved_value = EXCLUDED.achieved_value, note = EXCLUDED.note`,
      [target.rows[0].id, memberId],
    );
    const updatedMeasurement = await client.query<{ count: number; achieved_value: string }>(
      `SELECT COUNT(*)::integer AS count, MAX(achieved_value) AS achieved_value
         FROM target_measurements
        WHERE target_id = $1 AND member_id = $2 AND period_start = '2026-08-01'`,
      [target.rows[0].id, memberId],
    );
    assert(updatedMeasurement.rows[0].count === 1, 'KPI API upsert must not duplicate an existing member period.');
    assert(Number(updatedMeasurement.rows[0].achieved_value) === 8, 'KPI API upsert must update the achieved value.');

    await client.query(
      `INSERT INTO target_measurements (
         target_id, member_id, period_type, period_start, period_end, achieved_value
       ) VALUES ($1, $2, 'MONTHLY', '2026-08-01', '2026-08-31', 12)`,
      [target.rows[0].id, ownerId],
    );
    const measurementScopes = await client.query<{ count: number }>(
      `SELECT COUNT(*)::integer AS count
         FROM target_measurements
        WHERE target_id = $1 AND period_start = '2026-08-01'`,
      [target.rows[0].id],
    );
    assert(measurementScopes.rows[0].count === 2, 'The same KPI period must support separate member achievements.');

    await expectConstraintFailure(
      client,
      'negative_kpi_achievement',
      `INSERT INTO target_measurements (
         target_id, member_id, period_type, period_start, period_end, achieved_value
       ) VALUES ($1, NULL, 'MONTHLY', '2026-08-01', '2026-08-31', -1)`,
      [target.rows[0].id],
    );
    await expectConstraintFailure(
      client,
      'invalid_month_bounds',
      `INSERT INTO target_measurements (
         target_id, member_id, period_type, period_start, period_end, achieved_value
       ) VALUES ($1, NULL, 'MONTHLY', '2026-08-02', '2026-08-31', 1)`,
      [target.rows[0].id],
    );

    await client.query(
      `INSERT INTO period_reviews (
         department_id, member_id, goal_id, period_type, period_start, period_end,
         score, summary, achievements, challenges, next_steps, source_sheet, source_row
       ) VALUES (
         $1, $2, $3, 'MONTHLY', '2026-08-01', '2026-08-31',
         80, 'Imported summary', 'Imported achievement', 'Imported challenge',
         'Imported next step', 'Historical Review', 12
       ), (
         $1, $2, $3, 'MONTHLY', '2026-08-01', '2026-08-31',
         85, 'Management summary', 'Management achievement', 'Management challenge',
         'Management next step', NULL, NULL
       )`,
      [departmentId, memberId, goal.rows[0].id],
    );
    const reviewVersions = await client.query<{ total: number; imported: number; complete: number }>(
      `SELECT COUNT(*)::integer AS total,
              COUNT(*) FILTER (WHERE source_sheet IS NOT NULL)::integer AS imported,
              COUNT(*) FILTER (
                WHERE score IS NOT NULL AND summary IS NOT NULL AND achievements IS NOT NULL
                  AND challenges IS NOT NULL AND next_steps IS NOT NULL
              )::integer AS complete
         FROM period_reviews
        WHERE department_id = $1 AND member_id = $2 AND goal_id = $3`,
      [departmentId, memberId, goal.rows[0].id],
    );
    assert(reviewVersions.rows[0].total === 2, 'Manual evaluations must coexist with imported historical reviews.');
    assert(reviewVersions.rows[0].imported === 1, 'Imported evaluation source metadata must be retained.');
    assert(reviewVersions.rows[0].complete === 2, 'All evaluation fields must persist in PostgreSQL.');
    await client.query(
      `WITH existing AS (
         SELECT id FROM period_reviews
          WHERE department_id = $1 AND member_id IS NOT DISTINCT FROM $2::uuid
            AND goal_id IS NOT DISTINCT FROM $3::uuid AND period_type = 'MONTHLY'
            AND period_start = '2026-08-01' AND period_end = '2026-08-31'
            AND source_sheet IS NULL
          ORDER BY updated_at DESC LIMIT 1
       )
       UPDATE period_reviews pr
          SET score = 90, summary = 'Updated management summary'
         FROM existing
        WHERE pr.id = existing.id`,
      [departmentId, memberId, goal.rows[0].id],
    );
    const preservedReview = await client.query<{ total: number; imported_summary: string; manual_score: string }>(
      `SELECT COUNT(*)::integer AS total,
              MAX(summary) FILTER (WHERE source_sheet IS NOT NULL) AS imported_summary,
              MAX(score) FILTER (WHERE source_sheet IS NULL) AS manual_score
         FROM period_reviews
        WHERE department_id = $1 AND member_id = $2 AND goal_id = $3`,
      [departmentId, memberId, goal.rows[0].id],
    );
    assert(preservedReview.rows[0].total === 2, 'Evaluation upsert must not create another review version.');
    assert(preservedReview.rows[0].imported_summary === 'Imported summary', 'Evaluation upsert must not alter imported history.');
    assert(Number(preservedReview.rows[0].manual_score) === 90, 'Evaluation upsert must update only the manual review.');
    await expectConstraintFailure(
      client,
      'invalid_review_score',
      `INSERT INTO period_reviews (
         department_id, period_type, period_start, period_end, score
       ) VALUES ($1, 'MONTHLY', '2026-08-01', '2026-08-31', 101)`,
      [departmentId],
    );
    const crudFlags = await client.query<{ goal_active: boolean; target_active: boolean; action_active: boolean }>(
      `SELECT g.is_active AS goal_active,
              t.is_active AS target_active,
              a.is_active AS action_active
         FROM goals g
         JOIN targets t ON t.goal_id = g.id
         JOIN actions a ON a.goal_id = g.id
        WHERE g.id = $1 AND t.id = $2 AND a.id = $3`,
      [goal.rows[0].id, target.rows[0].id, action.rows[0].id],
    );
    assert(
      crudFlags.rows[0].goal_active && crudFlags.rows[0].target_active && crudFlags.rows[0].action_active,
      'Imported and newly-created structure rows must remain active by default.',
    );
    await client.query(
      `INSERT INTO action_assignees (action_id, member_id) VALUES ($1, $2)`,
      [action.rows[0].id, memberId],
    );

    const project = await client.query<{ id: string }>(
      `INSERT INTO projects (
         department_id, goal_id, client_name, name, code, owner_member_id,
         start_date, end_date, status, budget
       ) VALUES ($1, $2, 'Test Client', 'Test Project', 'JOB-TEST', $3,
                 '2026-08-10', '2026-08-31', 'ACTIVE', 125000)
       RETURNING id`,
      [departmentId, goal.rows[0].id, ownerId],
    );
    const projectId = project.rows[0].id;
    await client.query(
      `INSERT INTO project_members (project_id, member_id) VALUES ($1, $2), ($1, $3)`,
      [projectId, ownerId, memberId],
    );

    const closureCount = await client.query<{ count: number }>(
      `SELECT COUNT(*)::integer AS count FROM project_closure_items WHERE project_id = $1`,
      [projectId],
    );
    assert(closureCount.rows[0].count === 6, 'Every project must receive six closure items.');

    await expectConstraintFailure(
      client,
      'insert_closed',
      `INSERT INTO projects (
         department_id, goal_id, client_name, name, code, owner_member_id,
         start_date, end_date, status, budget
       ) VALUES ($1, $2, 'Test Client', 'Prematurely Closed', 'JOB-CLOSED', $3,
                 '2026-08-10', '2026-08-31', 'CLOSED', 100)`,
      [departmentId, goal.rows[0].id, ownerId],
    );

    const weekPlan = await client.query<{ id: string }>(
      `INSERT INTO week_plans (department_id, member_id, week_start)
       VALUES ($1, $2, DATE_TRUNC('week', CURRENT_DATE)::date) RETURNING id`,
      [departmentId, memberId],
    );
    const weekGoal = await client.query<{ id: string }>(
      `INSERT INTO week_goals (
         week_plan_id, department_id, assigned_member_id, goal_id,
         action_id, project_id, week_start, title
       ) VALUES ($1, $2, $3, $4, $5, $6, DATE_TRUNC('week', CURRENT_DATE)::date, 'Project Test Week')
       RETURNING id`,
      [weekPlan.rows[0].id, departmentId, memberId, goal.rows[0].id, action.rows[0].id, projectId],
    );
    await client.query(
      `INSERT INTO tasks (
         week_goal_id, action_id, project_id, assigned_member_id,
         week_start, title, task_date, status
       ) VALUES
         ($1, $2, $3, $4, DATE_TRUNC('week', CURRENT_DATE)::date, 'Done task', DATE_TRUNC('week', CURRENT_DATE)::date, 'DONE'),
         ($1, $2, $3, $4, DATE_TRUNC('week', CURRENT_DATE)::date, 'Active task', DATE_TRUNC('week', CURRENT_DATE)::date + 1, 'IN_PROGRESS'),
         ($1, $2, $3, $4, DATE_TRUNC('week', CURRENT_DATE)::date, 'Planned task', DATE_TRUNC('week', CURRENT_DATE)::date + 2, 'NOT_STARTED')`,
      [weekGoal.rows[0].id, action.rows[0].id, projectId, memberId],
    );

    const unmarkedWorkload = await client.query<{ availability_status: string }>(
      MEMBER_WORKLOAD_QUERY,
      [[memberId]],
    );
    assert(
      unmarkedWorkload.rows[0].availability_status === 'NOT_MARKED',
      'Workload must show missing attendance as Not Marked rather than absent.',
    );
    await client.query(
      `INSERT INTO attendance_records (member_id, attendance_date, status, source)
       VALUES ($1, CURRENT_DATE, 'ABSENT', 'MANUAL')`,
      [memberId],
    );
    const absentWorkload = await client.query<{ availability_status: string }>(
      MEMBER_WORKLOAD_QUERY,
      [[memberId]],
    );
    assert(
      absentWorkload.rows[0].availability_status === 'ABSENT',
      'Workload must retain an explicit absence as unavailable.',
    );

    await client.query(
      `INSERT INTO daily_updates (
         department_id, member_id, goal_id, action_id, update_date,
         activity, status, entry_type, source_sheet, source_row, source_cell
       ) VALUES
         ($1, $2, $3, $4, CURRENT_DATE, 'Imported completed action', 'DONE', 'WORK', 'Management', 100, 'A100'),
         ($1, $2, $3, NULL, CURRENT_DATE, 'Imported active goal', 'IN_PROGRESS', 'WORK', 'Operation', 101, 'A101'),
         ($1, NULL, NULL, NULL, CURRENT_DATE, 'Imported department work', 'NOT_STARTED', 'WORK', 'Management', 102, 'A102')`,
      [departmentId, memberId, goal.rows[0].id, action.rows[0].id],
    );

    await expectConstraintFailure(
      client,
      'weekend_task',
      `INSERT INTO tasks (
         week_goal_id, action_id, project_id, assigned_member_id,
         week_start, title, task_date, status
       ) VALUES (
         $1, $2, $3, $4, DATE_TRUNC('week', CURRENT_DATE)::date,
         'Weekend task', DATE_TRUNC('week', CURRENT_DATE)::date + 5, 'NOT_STARTED'
       )`,
      [weekGoal.rows[0].id, action.rows[0].id, projectId, memberId],
    );

    const workload = await client.query<{
      member_id: string;
      active_project_count: number;
      open_task_count: number;
      due_this_week_task_count: number;
      completed_this_week_task_count: number;
      overdue_task_count: number;
      active_projects: unknown[];
    }>(MEMBER_WORKLOAD_QUERY, [[memberId]]);
    assert(workload.rows.length === 1, 'Workload query must return the requested member only.');
    assert(workload.rows[0].active_project_count === 1, 'Workload must count active project assignments.');
    assert(workload.rows[0].open_task_count === 2, 'Workload must count non-Done daily tasks.');
    assert(workload.rows[0].due_this_week_task_count === 2, 'Workload must count open tasks due this week.');
    assert(workload.rows[0].completed_this_week_task_count === 1, 'Workload must count Done tasks dated this week.');
    assert(workload.rows[0].active_projects.length === 1, 'Workload allocation must reuse the assigned project.');

    await client.query(
      `WITH inserted AS (
         INSERT INTO projects (
           department_id, goal_id, client_name, name, code, owner_member_id,
           start_date, end_date, status, budget
         )
         SELECT $1, $2, 'Capacity Client', 'Capacity Project ' || series,
                'JOB-CAP-' || series, $3, CURRENT_DATE, CURRENT_DATE + 30, 'ACTIVE', 100
           FROM GENERATE_SERIES(1, 3) AS series
         RETURNING id
       )
       INSERT INTO project_members (project_id, member_id)
       SELECT id, $3 FROM inserted`,
      [departmentId, goal.rows[0].id, memberId],
    );
    const overloadedWorkload = await client.query<{
      active_project_count: number;
      open_task_count: number;
      due_this_week_task_count: number;
      overdue_task_count: number;
    }>(MEMBER_WORKLOAD_QUERY, [[memberId]]);
    const overloadedMetrics = overloadedWorkload.rows[0];
    assert(overloadedMetrics.active_project_count === 4, 'Soft cap must still allow and report four active projects.');
    assert(
      getCapacityStatus({
        activeProjectCount: overloadedMetrics.active_project_count,
        openTaskCount: overloadedMetrics.open_task_count,
        dueThisWeekTaskCount: overloadedMetrics.due_this_week_task_count,
        overdueTaskCount: overloadedMetrics.overdue_task_count,
      }) === 'Overloaded',
      'Four active projects must calculate as Overloaded.',
    );

    const progress = await client.query<{
      week_goal_progress: string;
      action_progress: string;
      project_progress: string;
      goal_progress: string;
      department_progress: string;
    }>(
      `SELECT wgp.progress_percent AS week_goal_progress,
              atp.progress_percent AS action_progress,
              ptp.progress_percent AS project_progress,
              gtp.progress_percent AS goal_progress,
              dwp.progress_percent AS department_progress
         FROM week_goal_progress wgp
         JOIN week_goals wg ON wg.id = wgp.week_goal_id
         JOIN action_task_progress atp ON atp.action_id = wg.action_id
         JOIN project_task_progress ptp ON ptp.project_id = wg.project_id
         JOIN goal_task_progress gtp ON gtp.goal_id = wg.goal_id
         JOIN department_work_progress dwp ON dwp.department_id = wg.department_id
        WHERE wg.id = $1`,
      [weekGoal.rows[0].id],
    );
    assert(Number(progress.rows[0].week_goal_progress) === 50, 'Weekly-goal progress must average task statuses.');
    assert(Number(progress.rows[0].action_progress) === 62.5, 'Action progress must combine task and imported history scores.');
    assert(Number(progress.rows[0].project_progress) === 50, 'Project progress must update from daily tasks.');
    assert(Number(progress.rows[0].goal_progress) === 60, 'Goal progress must combine task and imported history scores.');
    assert(Number(progress.rows[0].department_progress) === 50, 'Department progress must include imported department history.');

    const reportingProgress = await client.query<{
      total_tasks: number;
      done_tasks: number;
      progress_percent: string;
    }>(
      `SELECT COALESCE(SUM(total_tasks), 0)::integer AS total_tasks,
              COALESCE(SUM(done_tasks), 0)::integer AS done_tasks,
              ROUND(SUM(progress_percent * total_tasks) / NULLIF(SUM(total_tasks), 0), 2) AS progress_percent
         FROM task_period_progress
        WHERE department_id = $1
          AND period_type = 'WEEKLY'
          AND period_start = DATE_TRUNC('week', CURRENT_DATE)::date`,
      [departmentId],
    );
    assert(reportingProgress.rows[0].total_tasks === 6, 'Reports must include task and imported work entries.');
    assert(reportingProgress.rows[0].done_tasks === 2, 'Reports must count completed imported work entries.');
    assert(Number(reportingProgress.rows[0].progress_percent) === 50, 'Reports must weight imported and planned work together.');
    const goalReportingProgress = await client.query<{
      total_tasks: number;
      progress_percent: string;
    }>(
      `SELECT COALESCE(SUM(total_tasks), 0)::integer AS total_tasks,
              ROUND(SUM(progress_percent * total_tasks) / NULLIF(SUM(total_tasks), 0), 2) AS progress_percent
         FROM task_period_progress
        WHERE department_id = $1
          AND goal_id = $2
          AND period_type = 'WEEKLY'
          AND period_start = DATE_TRUNC('week', CURRENT_DATE)::date`,
      [departmentId, goal.rows[0].id],
    );
    assert(goalReportingProgress.rows[0].total_tasks === 5, 'Goal reports must exclude department-only history.');
    assert(Number(goalReportingProgress.rows[0].progress_percent) === 60, 'Goal reports must include goal-scoped imported history.');
    const historicalRows = await client.query<{ status: string }>(
      `SELECT status
         FROM daily_updates
        WHERE source_sheet IN ('Management', 'Operation')
          AND source_row BETWEEN 100 AND 102
        ORDER BY source_row`,
    );
    assert(
      historicalRows.rows.map((row) => row.status).join(',') === 'DONE,IN_PROGRESS,NOT_STARTED',
      'Progress aggregation must not modify imported rows.',
    );

    await client.query('SAVEPOINT carry_forward_test');
    const sourceTask = await client.query<{ id: string }>(
      `SELECT id FROM tasks WHERE week_goal_id = $1 AND status = 'NOT_STARTED' LIMIT 1`,
      [weekGoal.rows[0].id],
    );
    const nextWeekPlan = await client.query<{ id: string }>(
      `INSERT INTO week_plans (department_id, member_id, week_start)
       VALUES ($1, $2, DATE_TRUNC('week', CURRENT_DATE)::date + 7)
       RETURNING id`,
      [departmentId, memberId],
    );
    const nextWeekGoal = await client.query<{ id: string }>(
      `INSERT INTO week_goals (
         week_plan_id, department_id, assigned_member_id, goal_id,
         action_id, project_id, week_start, title
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         DATE_TRUNC('week', CURRENT_DATE)::date + 7, 'Carried Project Test Week'
       ) RETURNING id`,
      [nextWeekPlan.rows[0].id, departmentId, memberId, goal.rows[0].id, action.rows[0].id, projectId],
    );
    await client.query(
      `INSERT INTO tasks (
         week_goal_id, action_id, project_id, assigned_member_id,
         week_start, title, task_date, carried_from_task_id
       ) VALUES (
         $1, $2, $3, $4, DATE_TRUNC('week', CURRENT_DATE)::date + 7,
         'Carried task', DATE_TRUNC('week', CURRENT_DATE)::date + 7, $5
       )`,
      [nextWeekGoal.rows[0].id, action.rows[0].id, projectId, memberId, sourceTask.rows[0].id],
    );
    await expectConstraintFailure(
      client,
      'duplicate_carry',
      `INSERT INTO tasks (
         week_goal_id, action_id, project_id, assigned_member_id,
         week_start, title, task_date, carried_from_task_id
       ) VALUES (
         $1, $2, $3, $4, DATE_TRUNC('week', CURRENT_DATE)::date + 7,
         'Duplicate carried task', DATE_TRUNC('week', CURRENT_DATE)::date + 7, $5
       )`,
      [nextWeekGoal.rows[0].id, action.rows[0].id, projectId, memberId, sourceTask.rows[0].id],
      '23505',
    );
    await client.query('ROLLBACK TO SAVEPOINT carry_forward_test');

    const firstClosureItem = await client.query<{ id: string }>(
      `SELECT id FROM project_closure_items WHERE project_id = $1 LIMIT 1`,
      [projectId],
    );
    const closureApiUpdate = await client.query<{ department_id: string }>(
      `UPDATE project_closure_items pci
          SET assigned_member_id = CASE WHEN $3::boolean THEN $4::uuid ELSE pci.assigned_member_id END,
              is_completed = CASE WHEN $5::boolean THEN $6::boolean ELSE pci.is_completed END,
              completed_at = CASE
                WHEN $5::boolean AND $6::boolean THEN NOW()
                WHEN $5::boolean THEN NULL
                ELSE pci.completed_at
              END
         FROM projects p
        WHERE pci.id = $2
          AND pci.project_id = $1
          AND p.id = pci.project_id
          AND (NOT $3::boolean OR $4::uuid IS NULL OR EXISTS (
            SELECT 1 FROM project_members pm
             WHERE pm.project_id = p.id AND pm.member_id = $4
          ))
          AND (NOT ($5::boolean AND $6::boolean)
            OR CASE WHEN $3::boolean THEN $4::uuid ELSE pci.assigned_member_id END IS NOT NULL)
        RETURNING p.department_id`,
      [projectId, firstClosureItem.rows[0].id, true, memberId, true, true],
    );
    assert(
      closureApiUpdate.rows[0].department_id === departmentId,
      'Closure API update must validate the project member and return its department.',
    );

    await expectConstraintFailure(
      client,
      'close_incomplete',
      `UPDATE projects SET status = 'CLOSED' WHERE id = $1`,
      [projectId],
    );

    await client.query(
      `UPDATE project_closure_items
          SET assigned_member_id = $2,
              is_completed = TRUE,
              completed_at = NOW()
        WHERE project_id = $1`,
      [projectId, memberId],
    );
    await client.query(`UPDATE projects SET status = 'CLOSED' WHERE id = $1`, [projectId]);
    const closed = await client.query<{ status: string }>(
      `SELECT status FROM projects WHERE id = $1`,
      [projectId],
    );
    assert(closed.rows[0].status === 'CLOSED', 'Project must close after all required items are complete.');

    const closureItem = await client.query<{ id: string }>(
      `SELECT id FROM project_closure_items WHERE project_id = $1 LIMIT 1`,
      [projectId],
    );
    await expectConstraintFailure(
      client,
      'reopen_closed_item',
      `UPDATE project_closure_items
          SET is_completed = FALSE, completed_at = NULL
        WHERE id = $1`,
      [closureItem.rows[0].id],
    );

    await client.query(`UPDATE targets SET is_active = FALSE WHERE id = $1`, [target.rows[0].id]);
    await client.query(`UPDATE actions SET is_active = FALSE WHERE id = $1`, [action.rows[0].id]);
    await client.query(`UPDATE goals SET is_active = FALSE WHERE id = $1`, [goal.rows[0].id]);
    await client.query(`UPDATE members SET is_active = FALSE WHERE id = $1`, [memberId]);
    await client.query(`UPDATE departments SET is_active = FALSE WHERE id = $1`, [departmentId]);
    await expectConstraintFailure(
      client,
      'inactive_week_plan',
      `INSERT INTO week_plans (department_id, member_id, week_start)
       VALUES ($1, $2, DATE_TRUNC('week', CURRENT_DATE)::date + 14)`,
      [departmentId, memberId],
    );
    const retainedAfterDeactivation = await client.query<{
      targets: number;
      actions: number;
      goals: number;
      tasks: number;
      memberships: number;
    }>(
      `SELECT
         (SELECT COUNT(*)::integer FROM targets WHERE id = $1) AS targets,
         (SELECT COUNT(*)::integer FROM actions WHERE id = $2) AS actions,
         (SELECT COUNT(*)::integer FROM goals WHERE id = $3) AS goals,
         (SELECT COUNT(*)::integer FROM tasks WHERE action_id = $2) AS tasks,
         (SELECT COUNT(*)::integer FROM department_members
           WHERE department_id = $4 AND member_id = $5) AS memberships`,
      [target.rows[0].id, action.rows[0].id, goal.rows[0].id, departmentId, memberId],
    );
    assert(
      Object.values(retainedAfterDeactivation.rows[0]).every((count) => count > 0),
      'Structure deactivation must retain goals, targets, actions, tasks, and memberships.',
    );

    console.log('Database tests passed: migrations, API validation, KPI measurement progress, evaluation history, canonical financial periods, CRUD retention, read-only history, leave sync, active hierarchy, Monday–Friday tasks, carry-forward, task progress, workload, capacity, and closure rules.');
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
