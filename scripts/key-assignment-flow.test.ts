import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { Pool, type PoolClient } from 'pg';

function loadLocalEnvironment() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

async function visibleAssignmentIds(
  client: PoolClient,
  where: string,
  values: string[],
): Promise<string[]> {
  const result = await client.query<{ id: string }>(
    `SELECT ka.id
       FROM key_assignments ka
       JOIN assignment_keys ak ON ak.id = ka.key_id
       JOIN assignment_sub_goals sg ON sg.id = ka.sub_goal_id
       JOIN projects p ON p.id = ka.project_id
       JOIN task_master tm ON tm.id = ka.task_id
       JOIN members m ON m.id = ka.member_id
      WHERE ${where}`,
    values,
  );
  return result.rows.map((row) => row.id);
}

async function run() {
  loadLocalEnvironment();
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 1,
  });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const keys = await client.query<{ id: string; code: string }>(
      `SELECT id, code FROM assignment_keys ORDER BY code`,
    );
    assert.deepEqual(keys.rows.map((key) => key.code), ['KEY_A', 'KEY_B', 'KEY_C']);

    const project = (await client.query<{ id: string; department_id: string }>(
      `SELECT id, department_id FROM projects WHERE is_active ORDER BY created_at LIMIT 1`,
    )).rows[0];
    const member = (await client.query<{ id: string }>(
      `SELECT id FROM members WHERE is_active ORDER BY created_at LIMIT 1`,
    )).rows[0];
    assert(project, 'Acceptance test requires at least one active project.');
    assert(member, 'Acceptance test requires at least one active member.');

    const subGoal = (await client.query<{ id: string }>(
      `INSERT INTO assignment_sub_goals (key_id, title)
       VALUES ($1, 'Acceptance Test ' || gen_random_uuid()::text)
       RETURNING id`,
      [keys.rows[0].id],
    )).rows[0];
    const task = (await client.query<{ id: string; category: string }>(
      `INSERT INTO task_master (title)
       VALUES ('Acceptance Test ' || gen_random_uuid()::text)
       RETURNING id, category`,
    )).rows[0];
    assert.equal(task.category, 'General');

    const assignment = (await client.query<{ id: string }>(
      `INSERT INTO key_assignments (
         key_id, sub_goal_id, project_id, task_id, member_id,
         start_date, end_date, status
       ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, CURRENT_DATE + 7, 'NOT_STARTED')
       RETURNING id`,
      [keys.rows[0].id, subGoal.id, project.id, task.id, member.id],
    )).rows[0];

    const departmentIds = await visibleAssignmentIds(
      client,
      'p.department_id = $1',
      [project.department_id],
    );
    const projectIds = await visibleAssignmentIds(client, 'ka.project_id = $1', [project.id]);
    const memberIds = await visibleAssignmentIds(client, 'ka.member_id = $1', [member.id]);
    const reportIds = await visibleAssignmentIds(
      client,
      `p.department_id = $1
         AND ka.project_id = $2
         AND ka.key_id = $3
         AND ka.sub_goal_id = $4
         AND ka.task_id = $5
         AND ka.member_id = $6
         AND ka.status = 'NOT_STARTED'
         AND ka.end_date >= CURRENT_DATE
         AND ka.start_date <= CURRENT_DATE + 7`,
      [project.department_id, project.id, keys.rows[0].id, subGoal.id, task.id, member.id],
    );

    for (const ids of [departmentIds, projectIds, memberIds, reportIds]) {
      assert(ids.includes(assignment.id), 'The same assignment must be visible in every scope.');
    }

    console.log(`Validated assignment ${assignment.id} across Keys, Department, Project, Member, and Reports scopes.`);
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
