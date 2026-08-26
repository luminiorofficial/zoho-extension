import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import type { PoolClient } from "pg";

function loadLocalEnvironment(): void {
  const envPath = path.join(process.cwd(), ".env.local");

  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local was not found.");
  }

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);

    if (!match) continue;

    const key = match[1];
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function cellText(cell: ExcelJS.Cell): string {
  return String(cell.text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

type EmployeeMaster = {
  name: string;
  designation: string;
  team: string;
  department: string;
};

type ProjectMaster = {
  jobNo: string;
  jobCode: string;
  name: string;
  projectType: string;
  clientName: string | null;
  status: "ACTIVE" | "PLANNED";
};

async function readEmployees(
  filePath: string,
): Promise<EmployeeMaster[]> {
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.readFile(filePath);

  const worksheet =
    workbook.getWorksheet("Data Sheet") ??
    workbook.worksheets[0];

  if (!worksheet) {
    throw new Error("Team Alignment worksheet not found.");
  }

  const employees: EmployeeMaster[] = [];

  for (
    let rowNumber = 2;
    rowNumber <= worksheet.rowCount;
    rowNumber += 1
  ) {
    const row = worksheet.getRow(rowNumber);

    // Team Alignment.xlsx
    //
    // B = Name
    // F = Designation
    // G = Team
    // H = Departments

    const name = cellText(row.getCell(2));
    const designation = cellText(row.getCell(6));
    const team = cellText(row.getCell(7));
    const department = cellText(row.getCell(8));

    if (!name) continue;

    employees.push({
      name,
      designation,
      team,
      department,
    });
  }

  return employees;
}

function parseProject(
  jobNo: string,
  projectType: string,
): ProjectMaster {
  const parts = jobNo
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 4) {
    throw new Error(`Invalid project Job No: ${jobNo}`);
  }

  const jobCode = parts.slice(0, 3).join("/");
  const name = parts.slice(3).join(" / ");

  const clientName =
    parts.length >= 5
      ? parts[parts.length - 2]
      : null;

  const normalizedType = normalize(projectType);

  let status: "ACTIVE" | "PLANNED" = "PLANNED";

  if (normalizedType === "LIVE PROJECT") {
    status = "ACTIVE";
  }

  return {
    jobNo,
    jobCode,
    name,
    projectType,
    clientName,
    status,
  };
}

async function readProjects(
  filePath: string,
): Promise<ProjectMaster[]> {
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.readFile(filePath);

  const worksheet =
    workbook.getWorksheet("Data") ??
    workbook.worksheets[0];

  if (!worksheet) {
    throw new Error("CAC Projects Data worksheet not found.");
  }

  const projects: ProjectMaster[] = [];

  for (
    let rowNumber = 2;
    rowNumber <= worksheet.rowCount;
    rowNumber += 1
  ) {
    const row = worksheet.getRow(rowNumber);

    const jobNo = cellText(row.getCell(2));
    const projectType = cellText(row.getCell(3));

    if (!jobNo) continue;

    projects.push(
      parseProject(jobNo, projectType),
    );
  }

  return projects;
}

async function getOrCreateDepartment(
  client: PoolClient,
  departmentName: string,
): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `
    SELECT id
      FROM departments
     WHERE UPPER(
             REGEXP_REPLACE(
               BTRIM(name),
               '[[:space:]]+',
               ' ',
               'g'
             )
           ) =
           UPPER(
             REGEXP_REPLACE(
               BTRIM($1),
               '[[:space:]]+',
               ' ',
               'g'
             )
           )
     ORDER BY is_active DESC, created_at
     LIMIT 1
    `,
    [departmentName],
  );

  if (existing.rows[0]) {
    const departmentId = existing.rows[0].id;

    await client.query(
      `
      UPDATE departments
         SET is_active = TRUE,
             updated_at = NOW()
       WHERE id = $1
      `,
      [departmentId],
    );

    return departmentId;
  }

  const inserted = await client.query<{ id: string }>(
    `
    INSERT INTO departments (
      name,
      is_active
    )
    VALUES ($1, TRUE)
    RETURNING id
    `,
    [departmentName],
  );

  return inserted.rows[0].id;
}

async function syncEmployee(
  client: PoolClient,
  employee: EmployeeMaster,
): Promise<void> {
  if (!employee.department) {
    throw new Error(
      `Department is missing for employee: ${employee.name}`,
    );
  }

  const departmentId =
    await getOrCreateDepartment(
      client,
      employee.department,
    );

  const existing = await client.query<{ id: string }>(
    `
    SELECT id
      FROM members
     WHERE UPPER(
             REGEXP_REPLACE(
               BTRIM(name),
               '[[:space:]]+',
               ' ',
               'g'
             )
           ) =
           UPPER(
             REGEXP_REPLACE(
               BTRIM($1),
               '[[:space:]]+',
               ' ',
               'g'
             )
           )
     ORDER BY created_at
     LIMIT 1
    `,
    [employee.name],
  );

  let memberId: string;

  if (existing.rows[0]) {
    memberId = existing.rows[0].id;

    await client.query(
      `
      UPDATE members
         SET name = $2,
             role_title = NULLIF($3, ''),
             team = NULLIF($4, ''),
             current_department_id = $5,
             is_active = TRUE,
             updated_at = NOW()
       WHERE id = $1
      `,
      [
        memberId,
        employee.name,
        employee.designation,
        employee.team,
        departmentId,
      ],
    );
  } else {
    const inserted =
      await client.query<{ id: string }>(
        `
        INSERT INTO members (
          name,
          role_title,
          team,
          current_department_id,
          is_active
        )
        VALUES (
          $1,
          NULLIF($2, ''),
          NULLIF($3, ''),
          $4,
          TRUE
        )
        RETURNING id
        `,
        [
          employee.name,
          employee.designation,
          employee.team,
          departmentId,
        ],
      );

    memberId = inserted.rows[0].id;
  }

  /*
   * IMPORTANT:
   *
   * Do NOT delete old department_members rows.
   *
   * They may be referenced by historical weekly plans,
   * goals, tasks, attendance, etc.
   *
   * We only make sure that the CURRENT department
   * relationship exists.
   */
  await client.query(
    `
    INSERT INTO department_members (
      department_id,
      member_id
    )
    VALUES ($1, $2)
    ON CONFLICT (department_id, member_id)
    DO NOTHING
    `,
    [
      departmentId,
      memberId,
    ],
  );
}

async function syncProjects(
  client: PoolClient,
  projects: ProjectMaster[],
): Promise<void> {
  /*
   * Projects are intentionally left under the
   * existing OPERATION / PROJECT_MASTER structure
   * for now.
   *
   * Zoho department-wise project mapping will be
   * implemented separately after member departments
   * are correct.
   */

  const operationDepartmentId =
    await getOrCreateDepartment(
      client,
      "OPERATION",
    );

  let masterGoal =
    await client.query<{ id: string }>(
      `
      SELECT id
        FROM goals
       WHERE department_id = $1
         AND code = 'PROJECT_MASTER'
       LIMIT 1
      `,
      [operationDepartmentId],
    );

  let masterGoalId: string;

  if (masterGoal.rows[0]) {
    masterGoalId =
      masterGoal.rows[0].id;

    await client.query(
      `
      UPDATE goals
         SET title = 'Current Projects',
             is_active = TRUE,
             updated_at = NOW()
       WHERE id = $1
      `,
      [masterGoalId],
    );
  } else {
    masterGoal =
      await client.query<{ id: string }>(
        `
        INSERT INTO goals (
          department_id,
          code,
          title,
          description,
          status,
          progress_percent,
          is_active
        )
        VALUES (
          $1,
          'PROJECT_MASTER',
          'Current Projects',
          'Current projects from CAC Projects master workbook',
          'NOT_STARTED',
          0,
          TRUE
        )
        RETURNING id
        `,
        [operationDepartmentId],
      );

    masterGoalId =
      masterGoal.rows[0].id;
  }

  await client.query(
    `
    UPDATE projects
       SET is_active = FALSE
    `,
  );

  for (const project of projects) {
    let existingProject =
      await client.query<{ id: string }>(
        `
        SELECT id
          FROM projects
         WHERE master_job_no = $1
         LIMIT 1
        `,
        [project.jobNo],
      );

    if (!existingProject.rows[0]) {
      existingProject =
        await client.query<{ id: string }>(
          `
          SELECT id
            FROM projects
           WHERE department_id = $1
             AND LOWER(BTRIM(name)) =
                 LOWER(BTRIM($2))
           ORDER BY created_at
           LIMIT 1
          `,
          [
            operationDepartmentId,
            project.name,
          ],
        );
    }

    if (existingProject.rows[0]) {
      await client.query(
        `
        UPDATE projects
           SET department_id = $2,
               goal_id = $3,
               code = $4,
               name = $5,
               client_name = $6,
               status = $7,
               master_job_no = $8,
               project_type = $9,
               is_active = TRUE,
               updated_at = NOW()
         WHERE id = $1
        `,
        [
          existingProject.rows[0].id,
          operationDepartmentId,
          masterGoalId,
          project.jobCode,
          project.name,
          project.clientName,
          project.status,
          project.jobNo,
          project.projectType,
        ],
      );
    } else {
      await client.query(
        `
        INSERT INTO projects (
          department_id,
          goal_id,
          code,
          name,
          client_name,
          status,
          master_job_no,
          project_type,
          is_active
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          TRUE
        )
        `,
        [
          operationDepartmentId,
          masterGoalId,
          project.jobCode,
          project.name,
          project.clientName,
          project.status,
          project.jobNo,
          project.projectType,
        ],
      );
    }
  }
}

async function run(): Promise<void> {
  loadLocalEnvironment();

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is missing.",
    );
  }

  const applyChanges =
    process.argv.includes("--apply");

  const employeeFile = path.join(
    process.cwd(),
    "imports",
    "Team Alignment.xlsx",
  );

  const projectFile = path.join(
    process.cwd(),
    "imports",
    "CAC Projects.xlsx",
  );

  if (!fs.existsSync(employeeFile)) {
    throw new Error(
      `Missing ${employeeFile}`,
    );
  }

  if (!fs.existsSync(projectFile)) {
    throw new Error(
      `Missing ${projectFile}`,
    );
  }

  const employees =
    await readEmployees(employeeFile);

  const projects =
    await readProjects(projectFile);

  console.log("");
  console.log(
    "===================================",
  );
  console.log(
    "CLIENT MASTER DATA SYNC",
  );
  console.log(
    "===================================",
  );

  console.log(
    `Employees found: ${employees.length}`,
  );

  console.log(
    `Projects found: ${projects.length}`,
  );

  console.log("");

  if (employees.length !== 47) {
    throw new Error(
      `Expected 47 employees but found ${employees.length}.`,
    );
  }

  if (projects.length !== 40) {
    throw new Error(
      `Expected 40 projects but found ${projects.length}.`,
    );
  }

  const employeesWithoutDepartment =
    employees.filter(
      (employee) =>
        !employee.department.trim(),
    );

  if (employeesWithoutDepartment.length) {
    throw new Error(
      `Employees without department: ${employeesWithoutDepartment
        .map((employee) => employee.name)
        .join(", ")}`,
    );
  }

  console.log("Employees:");

  employees.forEach(
    (employee, index) => {
      console.log(
        `${index + 1}. ${employee.name} | ${employee.designation} | ${employee.team} | ${employee.department}`,
      );
    },
  );

  console.log("");
  console.log("Projects:");

  projects.forEach(
    (project, index) => {
      console.log(
        `${index + 1}. ${project.jobCode} | ${project.name} | ${project.projectType}`,
      );
    },
  );

  if (!applyChanges) {
    console.log("");
    console.log("DRY RUN ONLY.");
    console.log(
      "No database changes were made.",
    );
    console.log("");
    console.log(
      "Run again with --apply after checking the above data.",
    );

    return;
  }

  const { db } =
    await import("../src/lib/db");

  const client =
    await db.connect();

  try {
    await client.query("BEGIN");

    /*
     * Current Team Alignment.xlsx is the
     * source of truth for active employees.
     */
    await client.query(
      `
      UPDATE members
         SET is_active = FALSE,
             current_department_id = NULL
      `,
    );

    for (const employee of employees) {
      await syncEmployee(
        client,
        employee,
      );
    }

    await syncProjects(
      client,
      projects,
    );

    const employeeValidation =
      await client.query<{
        total: number;
        missing_department: number;
      }>(
        `
        SELECT
          COUNT(*)::integer AS total,
          (
            COUNT(*) FILTER (
              WHERE current_department_id IS NULL
            )
          )::integer AS missing_department
          FROM members
         WHERE is_active = TRUE
        `,
      );

    const projectValidation =
      await client.query<{
        total: number;
      }>(
        `
        SELECT
          COUNT(*)::integer AS total
          FROM projects
         WHERE is_active = TRUE
        `,
      );

    if (
      employeeValidation.rows[0].total !== 47
    ) {
      throw new Error(
        `Database validation failed: expected 47 active employees, got ${employeeValidation.rows[0].total}`,
      );
    }

    if (
      employeeValidation.rows[0]
        .missing_department !== 0
    ) {
      throw new Error(
        `Database validation failed: ${employeeValidation.rows[0].missing_department} active employees have no current department.`,
      );
    }

    if (
      projectValidation.rows[0].total !== 40
    ) {
      throw new Error(
        `Database validation failed: expected 40 active projects, got ${projectValidation.rows[0].total}`,
      );
    }

    const departmentCounts =
      await client.query<{
        name: string;
        count: number;
      }>(
        `
        SELECT
          d.name,
          COUNT(m.id)::integer AS count
          FROM departments d
          JOIN members m
            ON m.current_department_id = d.id
           AND m.is_active = TRUE
         GROUP BY d.id, d.name
         ORDER BY d.name
        `,
      );

    await client.query("COMMIT");

    console.log("");
    console.log(
      "===================================",
    );
    console.log("SYNC COMPLETED");
    console.log(
      "===================================",
    );

    console.log(
      `Active employees: ${employeeValidation.rows[0].total}`,
    );

    console.log(
      `Active projects: ${projectValidation.rows[0].total}`,
    );

    console.log("");
    console.log(
      "Current department counts:",
    );

    for (
      const department
      of departmentCounts.rows
    ) {
      console.log(
        `${department.name}: ${department.count}`,
      );
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await db.end();
  }
}

run().catch((error) => {
  console.error("");
  console.error(
    "MASTER SYNC FAILED:",
  );
  console.error(error);

  process.exitCode = 1;
});