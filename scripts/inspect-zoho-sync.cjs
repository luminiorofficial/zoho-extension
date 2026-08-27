/* eslint-disable @typescript-eslint/no-require-imports */
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
    const project = await pool.query(
      `
      SELECT p.id, p.name, p.code, p.master_job_no, p.is_active,
             zm.zoho_entity_id, zm.zoho_project_id, zm.sync_status
      FROM projects p
      LEFT JOIN zoho_mappings zm
        ON zm.entity_type = 'PROJECT' AND zm.local_id = p.id
      WHERE zm.zoho_entity_id = $1
         OR zm.zoho_project_id = $1
         OR p.master_job_no = $2
         OR UPPER(p.code) = UPPER($3)
      ORDER BY p.created_at
      `,
      [
        '445279000000068104',
        'Z1/026/2627/Pitch/Calmirize Rakshabandhan',
        'Z1/026/2627',
      ],
    );

    const duplicates = await pool.query(
      `
      SELECT COALESCE(zoho_entity_id, zoho_project_id) AS zoho_id,
             COUNT(*)::integer AS count
      FROM zoho_mappings
      WHERE entity_type = 'PROJECT'
      GROUP BY COALESCE(zoho_entity_id, zoho_project_id)
      HAVING COUNT(*) > 1
      `,
    );

    console.log(JSON.stringify({ project: project.rows, duplicates: duplicates.rows }, null, 2));
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
