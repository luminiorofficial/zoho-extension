import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

const FILES = {
  stop: "STOP -CAC 26_27.xlsx",
  projects: "CAC Projects.xlsx",
  members: "Team Alignment.xlsx",
} as const;

type MatchStatus = "MATCHED" | "UNMATCHED" | "DUPLICATE";
type KeyCode = "KEY_A" | "KEY_B" | "KEY_C";

export interface SourceRef {
  file: string;
  sheet: string;
  row: number;
}

export interface SubGoalSource extends SourceRef {
  keyCode: KeyCode;
  sourceCode: string;
  title: string;
  description: string | null;
  validationError: string | null;
}

export interface ProjectSource extends SourceRef {
  masterJobNo: string;
  code: string;
  name: string;
  clientName: string | null;
  projectType: string;
}

export interface TaskSource extends SourceRef {
  category: string;
  title: string;
  validationError: string | null;
}

export interface MemberSource extends SourceRef {
  name: string;
  designation: string;
  team: string;
  department: string;
}

interface ExistingKey extends QueryResultRow {
  id: string;
  code: string;
  title: string;
}

interface ExistingSubGoal extends QueryResultRow {
  id: string;
  key_id: string;
  key_code: string;
  title: string;
  is_active: boolean;
}

interface ExistingProject extends QueryResultRow {
  id: string;
  name: string;
  code: string | null;
  client_name: string | null;
  master_job_no: string | null;
  project_type: string | null;
  department_name: string;
  is_active: boolean;
}

interface ExistingTask extends QueryResultRow {
  id: string;
  category: string;
  title: string;
  is_active: boolean;
}

interface ExistingMember extends QueryResultRow {
  id: string;
  name: string;
  zoho_user_id: string | null;
  is_active: boolean;
}

interface ExistingZohoMapping extends QueryResultRow {
  id: string;
  entity_type: string;
  local_id: string;
  zoho_entity_id: string | null;
  zoho_project_id: string | null;
  sync_status: string | null;
}

interface ReconciliationRecord {
  status: MatchStatus;
  label: string;
  source: SourceRef;
  matches: string[];
  note: string;
  localId?: string;
}

interface DatabaseSnapshot {
  keys: ExistingKey[];
  subGoals: ExistingSubGoal[];
  projects: ExistingProject[];
  tasks: ExistingTask[];
  members: ExistingMember[];
  zohoMappings: ExistingZohoMapping[];
}

interface DryRunReport {
  subGoals: ReconciliationRecord[];
  projects: ReconciliationRecord[];
  tasks: ReconciliationRecord[];
  members: ReconciliationRecord[];
  zohoMappings: ReconciliationRecord[];
}

function loadLocalEnvironment(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;

    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return compact(value.toString());

  if ("richText" in value) {
    return compact(value.richText.map((part) => part.text).join(""));
  }

  if ("result" in value && value.result !== null && value.result !== undefined) {
    return compact(String(value.result));
  }

  return compact(String(cell.text ?? ""));
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalize(value: string): string {
  return compact(value)
    .normalize("NFKC")
    .replace(/[–—]/g, "-")
    .toLocaleUpperCase("en-IN");
}

function sourceLabel(source: SourceRef): string {
  return `${source.file} :: ${source.sheet}!${source.row}`;
}

function workbookPath(file: string): string {
  const filePath = path.join(process.cwd(), "imports", file);
  if (!fs.existsSync(filePath)) throw new Error(`Workbook not found: ${filePath}`);
  return filePath;
}

function getWorksheet(workbook: ExcelJS.Workbook, expectedName: string): ExcelJS.Worksheet {
  const normalizedName = normalize(expectedName);
  const worksheet = workbook.worksheets.find(
    (candidate) => normalize(candidate.name) === normalizedName,
  );

  if (!worksheet) throw new Error(`Worksheet not found: ${expectedName}`);
  return worksheet;
}

function subGoalParts(columnA: string, columnB: string): {
  sourceCode: string;
  keyCode: KeyCode;
  title: string;
} | null {
  const match = columnA.match(/^\s*([ABC])\s*(\d+)\s*(?:(?:-|:|\.)\s*(.*))?$/i);
  if (!match) return null;

  const letter = match[1].toUpperCase() as "A" | "B" | "C";
  const sourceCode = `${letter} ${Number(match[2])}`;
  const inlineTitle = compact(match[3] ?? "");

  return {
    sourceCode,
    keyCode: `KEY_${letter}`,
    title: inlineTitle || compact(columnB),
  };
}

export async function readSubGoals(filePath: string): Promise<SubGoalSource[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = getWorksheet(workbook, "Operation");
  const records: SubGoalSource[] = [];

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const columnA = cellText(row.getCell(1));
    const columnB = cellText(row.getCell(2));
    const parsed = subGoalParts(columnA, columnB);
    if (!parsed) continue;

    const description = columnB && normalize(columnB) !== normalize(parsed.title) ? columnB : null;
    let validationError: string | null = null;
    if (!parsed.title) validationError = "The spreadsheet row has a sub-goal code but no title.";
    else if (parsed.title.length > 300) {
      validationError = `The title is ${parsed.title.length} characters; assignment_sub_goals.title allows 300.`;
    }

    records.push({
      file: path.basename(filePath),
      sheet: worksheet.name.trim(),
      row: rowNumber,
      keyCode: parsed.keyCode,
      sourceCode: parsed.sourceCode,
      title: parsed.title,
      description,
      validationError,
    });
  }

  return records;
}

function parseProjectJobNumber(masterJobNo: string): Omit<ProjectSource, keyof SourceRef | "projectType"> {
  const parts = masterJobNo.split("/").map(compact).filter(Boolean);
  if (parts.length < 4) throw new Error(`Invalid Job No.: ${masterJobNo}`);

  return {
    masterJobNo: compact(masterJobNo),
    code: parts.slice(0, 3).join("/"),
    name: parts.slice(3).join(" / "),
    clientName: parts.length >= 5 ? parts.at(-2) ?? null : null,
  };
}

export async function readProjects(filePath: string): Promise<ProjectSource[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = getWorksheet(workbook, "Data");
  const records: ProjectSource[] = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const masterJobNo = cellText(row.getCell(2));
    if (!masterJobNo) continue;

    records.push({
      file: path.basename(filePath),
      sheet: worksheet.name.trim(),
      row: rowNumber,
      ...parseProjectJobNumber(masterJobNo),
      projectType: cellText(row.getCell(3)),
    });
  }

  return records;
}

export async function readTasks(filePath: string): Promise<TaskSource[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = getWorksheet(workbook, "Task Type");
  const records: TaskSource[] = [];
  let category = "";

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    category = cellText(row.getCell(1)) || category;
    const title = cellText(row.getCell(2));
    if (!category && !title) continue;

    records.push({
      file: path.basename(filePath),
      sheet: worksheet.name.trim(),
      row: rowNumber,
      category,
      title,
      validationError: title ? null : "The spreadsheet category row has no task title.",
    });
  }

  return records;
}

export async function readMembers(filePath: string): Promise<MemberSource[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = getWorksheet(workbook, "Data Sheet");
  const records: MemberSource[] = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const name = cellText(row.getCell(2));
    if (!name) continue;

    records.push({
      file: path.basename(filePath),
      sheet: worksheet.name.trim(),
      row: rowNumber,
      name,
      designation: cellText(row.getCell(6)),
      team: cellText(row.getCell(7)),
      department: cellText(row.getCell(8)),
    });
  }

  return records;
}

async function readDatabaseSnapshot(client: PoolClient): Promise<DatabaseSnapshot> {
  // A PoolClient executes one query at a time. Keep these sequential so the
  // entire snapshot stays inside the same explicit read-only transaction.
  const keys = await client.query<ExistingKey>(
    `SELECT id, code, title FROM assignment_keys ORDER BY code`,
  );
  const subGoals = await client.query<ExistingSubGoal>(
      `SELECT sg.id, sg.key_id, ak.code AS key_code, sg.title, sg.is_active
         FROM assignment_sub_goals sg
         JOIN assignment_keys ak ON ak.id = sg.key_id
        ORDER BY ak.code, sg.title`,
    );
  const projects = await client.query<ExistingProject>(
      `SELECT p.id, p.name, p.code, p.client_name, p.master_job_no, p.project_type,
              d.name AS department_name, p.is_active
         FROM projects p
         JOIN departments d ON d.id = p.department_id
        ORDER BY p.name, p.created_at`,
    );
  const tasks = await client.query<ExistingTask>(
      `SELECT id, category, title, is_active FROM task_master ORDER BY category, title`,
    );
  const members = await client.query<ExistingMember>(
      `SELECT id, name, zoho_user_id, is_active FROM members ORDER BY name, created_at`,
    );
  const zohoMappings = await client.query<ExistingZohoMapping>(
      `SELECT id, entity_type, local_id, zoho_entity_id, zoho_project_id, sync_status
         FROM zoho_mappings
        WHERE UPPER(entity_type) = 'PROJECT'
        ORDER BY local_id, created_at`,
    );

  return {
    keys: keys.rows,
    subGoals: subGoals.rows,
    projects: projects.rows,
    tasks: tasks.rows,
    members: members.rows,
    zohoMappings: zohoMappings.rows,
  };
}

function duplicateKeys<T>(records: T[], key: (record: T) => string): Set<string> {
  const counts = new Map<string, number>();
  for (const record of records) {
    const value = key(record);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return new Set([...counts].filter(([, count]) => count > 1).map(([value]) => value));
}

function projectCandidates(
  source: ProjectSource,
  existing: ExistingProject[],
): { strategy: string; candidates: ExistingProject[] } {
  const strategies: [string, (project: ExistingProject) => boolean][] = [
    ["master Job No.", (project) => normalize(project.master_job_no ?? "") === normalize(source.masterJobNo)],
    [
      "code + name",
      (project) => normalize(project.code ?? "") === normalize(source.code) &&
        normalize(project.name) === normalize(source.name),
    ],
    ["name", (project) => normalize(project.name) === normalize(source.name)],
    ["unique code", (project) => normalize(project.code ?? "") === normalize(source.code)],
  ];

  for (const [strategy, predicate] of strategies) {
    const candidates = existing.filter(predicate);
    if (candidates.length) return { strategy, candidates };
  }

  return { strategy: "none", candidates: [] };
}

function projectMatchLabel(project: ExistingProject): string {
  return `${project.name} [${project.code ?? "no code"}; ${project.department_name}; ${project.is_active ? "active" : "inactive"}]`;
}

function reconcileSubGoals(
  sources: SubGoalSource[],
  snapshot: DatabaseSnapshot,
): ReconciliationRecord[] {
  const sourceDuplicates = duplicateKeys(
    sources.filter((source) => !source.validationError),
    (source) => `${source.keyCode}\u0000${normalize(source.title)}`,
  );

  return sources.map((source) => {
    const label = `${source.keyCode} → ${source.sourceCode}${source.title ? ` → ${source.title}` : ""}`;
    if (source.validationError) {
      return { status: "UNMATCHED", label, source, matches: [], note: source.validationError };
    }

    const sourceKey = `${source.keyCode}\u0000${normalize(source.title)}`;
    if (sourceDuplicates.has(sourceKey)) {
      const rows = sources
        .filter((candidate) => `${candidate.keyCode}\u0000${normalize(candidate.title)}` === sourceKey)
        .map((candidate) => `${candidate.sheet}!${candidate.row}`);
      return {
        status: "DUPLICATE",
        label,
        source,
        matches: rows,
        note: "The same normalized global key/sub-goal appears more than once in STOP Operation.",
      };
    }

    const keys = snapshot.keys.filter((key) => normalize(key.code) === source.keyCode);
    if (keys.length !== 1) {
      return {
        status: keys.length ? "DUPLICATE" : "UNMATCHED",
        label,
        source,
        matches: keys.map((key) => `${key.code} (${key.id})`),
        note: keys.length ? "The global key is ambiguous in the database." : "The global key does not exist.",
      };
    }

    const matches = snapshot.subGoals.filter(
      (subGoal) => subGoal.key_id === keys[0].id && normalize(subGoal.title) === normalize(source.title),
    );
    return {
      status: matches.length === 1 ? "MATCHED" : matches.length > 1 ? "DUPLICATE" : "UNMATCHED",
      label,
      source,
      matches: matches.map((match) => `${match.title} (${match.id}; ${match.is_active ? "active" : "inactive"})`),
      note: matches.length === 1
        ? "Matched by global key and normalized title."
        : matches.length > 1
          ? "Multiple database sub-goals match the global key and title."
          : "No existing sub-goal matches this global key and title.",
      localId: matches.length === 1 ? matches[0].id : undefined,
    };
  });
}

function reconcileProjects(
  sources: ProjectSource[],
  snapshot: DatabaseSnapshot,
): ReconciliationRecord[] {
  const sourceDuplicates = duplicateKeys(sources, (source) => normalize(source.masterJobNo));

  return sources.map((source) => {
    const label = `${source.masterJobNo} → ${source.name}`;
    if (sourceDuplicates.has(normalize(source.masterJobNo))) {
      const rows = sources
        .filter((candidate) => normalize(candidate.masterJobNo) === normalize(source.masterJobNo))
        .map((candidate) => `${candidate.sheet}!${candidate.row}`);
      return {
        status: "DUPLICATE",
        label,
        source,
        matches: rows,
        note: "The same normalized Job No. appears more than once in CAC Projects Data.",
      };
    }

    const result = projectCandidates(source, snapshot.projects);
    const status: MatchStatus = result.candidates.length === 1
      ? "MATCHED"
      : result.candidates.length > 1
        ? "DUPLICATE"
        : "UNMATCHED";

    return {
      status,
      label,
      source,
      matches: result.candidates.map(projectMatchLabel),
      note: status === "MATCHED"
        ? `Matched an existing project by ${result.strategy}; no project fields will be changed.`
        : status === "DUPLICATE"
          ? `More than one existing project matched by ${result.strategy}; no project was selected.`
          : "No existing project matched; the importer will not create one.",
      localId: status === "MATCHED" ? result.candidates[0].id : undefined,
    };
  });
}

function reconcileTasks(
  sources: TaskSource[],
  snapshot: DatabaseSnapshot,
): ReconciliationRecord[] {
  const sourceDuplicates = duplicateKeys(
    sources.filter((source) => !source.validationError),
    (source) => `${normalize(source.category)}\u0000${normalize(source.title)}`,
  );

  return sources.map((source) => {
    const label = `${source.category || "(blank category)"} → ${source.title || "(blank task)"}`;
    if (source.validationError) {
      return { status: "UNMATCHED", label, source, matches: [], note: source.validationError };
    }

    const sourceKey = `${normalize(source.category)}\u0000${normalize(source.title)}`;
    if (sourceDuplicates.has(sourceKey)) {
      const rows = sources
        .filter(
          (candidate) => `${normalize(candidate.category)}\u0000${normalize(candidate.title)}` === sourceKey,
        )
        .map((candidate) => `${candidate.sheet}!${candidate.row}`);
      return {
        status: "DUPLICATE",
        label,
        source,
        matches: rows,
        note: "The same normalized task category/title appears more than once in CAC Projects Task Type.",
      };
    }

    const matches = snapshot.tasks.filter(
      (task) => normalize(task.category) === normalize(source.category) &&
        normalize(task.title) === normalize(source.title),
    );
    return {
      status: matches.length === 1 ? "MATCHED" : matches.length > 1 ? "DUPLICATE" : "UNMATCHED",
      label,
      source,
      matches: matches.map((task) => `${task.category} → ${task.title} (${task.id}; ${task.is_active ? "active" : "inactive"})`),
      note: matches.length === 1
        ? "Matched by normalized category and title."
        : matches.length > 1
          ? "Multiple task_master rows match this category and title."
          : "No task_master row matches this category and title.",
      localId: matches.length === 1 ? matches[0].id : undefined,
    };
  });
}

function reconcileMembers(
  sources: MemberSource[],
  snapshot: DatabaseSnapshot,
): ReconciliationRecord[] {
  const sourceDuplicates = duplicateKeys(sources, (source) => normalize(source.name));

  return sources.map((source) => {
    const label = `${source.name} [${source.department || "no department"}]`;
    if (sourceDuplicates.has(normalize(source.name))) {
      const rows = sources
        .filter((candidate) => normalize(candidate.name) === normalize(source.name))
        .map((candidate) => `${candidate.sheet}!${candidate.row}`);
      return {
        status: "DUPLICATE",
        label,
        source,
        matches: rows,
        note: "The same normalized member name appears more than once in Team Alignment Data Sheet.",
      };
    }

    const matches = snapshot.members.filter((member) => normalize(member.name) === normalize(source.name));
    return {
      status: matches.length === 1 ? "MATCHED" : matches.length > 1 ? "DUPLICATE" : "UNMATCHED",
      label,
      source,
      matches: matches.map(
        (member) => `${member.name} (${member.id}; ${member.is_active ? "active" : "inactive"}; Zoho user ${member.zoho_user_id ?? "not mapped"})`,
      ),
      note: matches.length === 1
        ? "Matched an existing member by normalized full name; department and Zoho fields are preserved."
        : matches.length > 1
          ? "Multiple existing members have this normalized full name; no member was selected."
          : "No existing member matched; the importer will not create one.",
      localId: matches.length === 1 ? matches[0].id : undefined,
    };
  });
}

function zohoId(mapping: ExistingZohoMapping): string | null {
  return mapping.zoho_entity_id ?? mapping.zoho_project_id;
}

function reconcileZohoMappings(
  projectRecords: ReconciliationRecord[],
  snapshot: DatabaseSnapshot,
): ReconciliationRecord[] {
  const duplicateZohoIds = duplicateKeys(
    snapshot.zohoMappings.filter((mapping) => zohoId(mapping)),
    (mapping) => normalize(zohoId(mapping) ?? ""),
  );

  return projectRecords.map((project) => {
    const label = project.label;
    if (project.status !== "MATCHED" || !project.localId) {
      return {
        status: project.status === "DUPLICATE" ? "DUPLICATE" : "UNMATCHED",
        label,
        source: project.source,
        matches: [],
        note: "Zoho mapping cannot be reconciled until the source project has one unambiguous existing-project match.",
      };
    }

    const mappings = snapshot.zohoMappings.filter((mapping) => mapping.local_id === project.localId);
    const validMappings = mappings.filter((mapping) => zohoId(mapping));
    const hasSharedZohoId = validMappings.some((mapping) =>
      duplicateZohoIds.has(normalize(zohoId(mapping) ?? "")),
    );

    const status: MatchStatus = validMappings.length === 1 && !hasSharedZohoId
      ? "MATCHED"
      : validMappings.length > 1 || hasSharedZohoId
        ? "DUPLICATE"
        : "UNMATCHED";

    return {
      status,
      label,
      source: project.source,
      matches: mappings.map(
        (mapping) => `local ${mapping.local_id} → Zoho ${zohoId(mapping) ?? "blank"} (${mapping.sync_status ?? "no status"})`,
      ),
      note: status === "MATCHED"
        ? "Existing valid Zoho project mapping found; it will be preserved."
        : status === "DUPLICATE"
          ? "Multiple or shared Zoho project mappings need review; none will be changed."
          : mappings.length
            ? "Only blank/invalid Zoho mapping rows were found; none will be changed."
            : "The matched project has no existing Zoho project mapping; no mapping can be inferred from the workbook.",
    };
  });
}

function printSection(title: string, records: ReconciliationRecord[]): void {
  const counts: Record<MatchStatus, number> = { MATCHED: 0, UNMATCHED: 0, DUPLICATE: 0 };
  records.forEach((record) => { counts[record.status] += 1; });

  console.log("");
  console.log(`=== ${title} ===`);
  console.log(
    `TOTAL ${records.length} | MATCHED ${counts.MATCHED} | UNMATCHED ${counts.UNMATCHED} | DUPLICATE ${counts.DUPLICATE}`,
  );

  for (const status of ["MATCHED", "UNMATCHED", "DUPLICATE"] as const) {
    console.log(`-- ${status} --`);
    const statusRecords = records.filter((record) => record.status === status);
    if (!statusRecords.length) console.log("  (none)");

    statusRecords.forEach((record) => {
      console.log(`  [${sourceLabel(record.source)}] ${record.label}`);
      console.log(`    ${record.note}`);
      record.matches.forEach((match) => console.log(`    ↳ ${match}`));
    });
  }
}

function printReport(report: DryRunReport): void {
  console.log("============================================================");
  console.log("WORK PLANNING EXCEL IMPORT — DRY RUN");
  console.log("READ-ONLY: PostgreSQL transaction is READ ONLY and is rolled back.");
  console.log("No projects, members, departments, tasks, sub-goals, Zoho mappings, or key assignments were written.");
  console.log("============================================================");

  printSection("SUB GOALS (STOP Operation → global KEY A/B/C)", report.subGoals);
  printSection("PROJECTS (CAC Projects Data → existing projects only)", report.projects);
  printSection("TASKS (CAC Projects Task Type → task_master)", report.tasks);
  printSection("MEMBERS (Team Alignment Data Sheet → existing members)", report.members);
  printSection("ZOHO PROJECT MAPPINGS (existing mappings only)", report.zohoMappings);

  console.log("");
  console.log("=== KEY ASSIGNMENTS ===");
  console.log("CREATED 0");
  console.log(
    "The three workbooks do not explicitly prove a complete Key → Sub Goal → Project → Task → Member → Start Date → End Date relationship. No key_assignments are proposed or created.",
  );
  console.log("");
  console.log("Dry-run complete. --apply is intentionally not available until this output is reviewed.");
}

async function run(): Promise<void> {
  if (process.argv.includes("--apply")) {
    throw new Error("--apply is not implemented yet. Review the dry-run before enabling database writes.");
  }

  loadLocalEnvironment();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");

  const [subGoals, projects, tasks, members] = await Promise.all([
    readSubGoals(workbookPath(FILES.stop)),
    readProjects(workbookPath(FILES.projects)),
    readTasks(workbookPath(FILES.projects)),
    readMembers(workbookPath(FILES.members)),
  ]);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
    max: 1,
    application_name: "work-planning-import-dry-run",
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    const snapshot = await readDatabaseSnapshot(client);
    const projectReport = reconcileProjects(projects, snapshot);
    const report: DryRunReport = {
      subGoals: reconcileSubGoals(subGoals, snapshot),
      projects: projectReport,
      tasks: reconcileTasks(tasks, snapshot),
      members: reconcileMembers(members, snapshot),
      zohoMappings: reconcileZohoMappings(projectReport, snapshot),
    };

    printReport(report);
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error("Dry-run import failed:", error);
    process.exitCode = 1;
  });
}
