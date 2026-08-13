import fs from 'node:fs';
import path from 'node:path';

import { Pool, type PoolClient } from 'pg';

import { getCapacityStatus } from '../lib/capacity';
import { MEMBER_WORKLOAD_QUERY } from '../lib/workload-query';

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
): Promise<void> {
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    await client.query(query, values);
    throw new Error(`Expected constraint failure at ${savepoint}.`);
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    assert(
      typeof error === 'object' && error !== null && 'code' in error && error.code === '23514',
      `Expected PostgreSQL check violation at ${savepoint}.`,
    );
  }
}

async function run(): Promise<void> {
  loadLocalEnvironment();
  assert(process.env.DATABASE_URL, 'DATABASE_URL is required for database tests.');

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
    await client.query(`SET LOCAL search_path TO ${schema}, public`);

    for (const migration of [
      '001_init.sql',
      '002_work_planning.sql',
      '003_financial_year_progress.sql',
      '004_project_management_closure.sql',
      '005_attendance_leave.sql',
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
      total_tasks: number;
      done_tasks: number;
      progress_percent: string;
    }>(
      `SELECT total_tasks, done_tasks, progress_percent
         FROM project_task_progress WHERE project_id = $1`,
      [projectId],
    );
    assert(progress.rows[0].total_tasks === 3, 'Project progress must count linked daily tasks.');
    assert(progress.rows[0].done_tasks === 1, 'Project progress must count completed daily tasks.');
    assert(Number(progress.rows[0].progress_percent) === 50, 'Task-derived project progress must average to 50%.');

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

    console.log('Database tests passed: migrations, attendance history, leave sync, hierarchy, progress, workload, capacity, and closure rules.');
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
