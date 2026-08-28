/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

function loadLocalEnvironment() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

async function run() {
  loadLocalEnvironment();
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
    max: 1,
  });

  try {
    const sql = fs.readFileSync(
      path.join(process.cwd(), 'database', '024_key_assignment_import_provenance.sql'),
      'utf8',
    );
    await pool.query(sql);
    console.log('Applied database/024_key_assignment_import_provenance.sql');
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
