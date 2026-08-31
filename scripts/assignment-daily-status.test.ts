import fs from 'node:fs';
import path from 'node:path';

import { Pool } from 'pg';

import { moveTrackerAnchor, trackerColumns, trackerPeriod } from '../src/lib/assignment-tracker-periods';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function loadLocalEnvironment(): void {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

async function run(): Promise<void> {
  const recent = trackerPeriod('RECENT_7', '2026-08-31');
  assert(recent.start === '2026-08-25' && recent.end === '2026-08-31', 'Recent view must contain exactly the trailing seven dates.');
  assert(trackerColumns('RECENT_7', recent).length === 7, 'Recent view must render seven daily columns.');

  const days28 = trackerPeriod('DAYS_28', '2026-08-31');
  const days28Columns = trackerColumns('DAYS_28', days28);
  assert(days28Columns.length === 4 && days28Columns.every((column) => column.kind === 'week'), '28-day view must render four weekly summaries.');

  const month = trackerPeriod('MONTHLY', '2026-08-31');
  assert(trackerColumns('MONTHLY', month).every((column) => column.kind === 'week'), 'Monthly view must use weekly summaries.');
  assert(moveTrackerAnchor('MONTHLY', '2026-08-31', 1).startsWith('2026-09'), 'Monthly navigation must not skip shorter months.');

  const quarter = trackerPeriod('QUARTERLY', '2026-08-31');
  const quarterColumns = trackerColumns('QUARTERLY', quarter);
  assert(quarter.start === '2026-07-01' && quarter.end === '2026-09-30', 'Quarterly view must reuse the canonical financial-quarter calculation.');
  assert(quarterColumns.length === 3 && quarterColumns.every((column) => column.kind === 'month'), 'Quarterly view must render monthly summaries.');

  loadLocalEnvironment();
  assert(process.env.DATABASE_URL, 'DATABASE_URL is required for the schema check.');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 1,
  });
  try {
    const result = await pool.query<{ table_exists: boolean; has_unique_constraint: boolean; has_assignment_fk: boolean }>(
      `SELECT
         TO_REGCLASS('assignment_daily_status') IS NOT NULL AS table_exists,
         EXISTS (
           SELECT 1 FROM pg_constraint
            WHERE conrelid = 'assignment_daily_status'::regclass
              AND contype = 'u'
              AND pg_get_constraintdef(oid) = 'UNIQUE (assignment_id, work_date)'
         ) AS has_unique_constraint,
         EXISTS (
           SELECT 1 FROM pg_constraint
            WHERE conrelid = 'assignment_daily_status'::regclass
              AND contype = 'f'
              AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (assignment_id) REFERENCES key_assignments(id)%'
         ) AS has_assignment_fk`,
    );
    const schema = result.rows[0];
    assert(schema.table_exists, 'assignment_daily_status must exist in PostgreSQL.');
    assert(schema.has_unique_constraint, 'assignment_id + work_date must be unique.');
    assert(schema.has_assignment_fk, 'Daily status must retain a foreign key to key_assignments.');
  } finally {
    await pool.end();
  }

  console.log('Daily status tests passed: daily/weekly/monthly period behavior and PostgreSQL constraints.');
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
