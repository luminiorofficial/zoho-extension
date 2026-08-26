const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
    max: 1,
  });

  try {
    const sql = fs.readFileSync(
      path.join(process.cwd(), 'database', '020_zoho_project_sync.sql'),
      'utf8',
    );
    await pool.query(sql);
    console.log('Applied database/020_zoho_project_sync.sql');
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
