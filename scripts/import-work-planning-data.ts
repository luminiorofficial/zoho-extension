import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

const FILES = {
  stop: ["STOP -CAC 26_27.xlsx"],
  projects: ["CAC Projects.xlsx"],
  members: ["Team Alignment(7).xlsx", "Team Alignment.xlsx"],
} as const;

const SUB_GOAL_SHEETS = ["Operation", "Management"] as const;

type MatchStatus = "MATCHED" | "UNMATCHED" | "AMBIGUOUS";
type Disposition = "INSERT" | "EXISTING" | "RECONCILE" | "READ_ONLY_MATCH" | "SKIP";
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
  description: string | null;
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

interface SourceGroup<T extends SourceRef> {
  identity: string;
  canonical: T;
  records: T[];
}

interface ReconciliationRecord {
  status: MatchStatus;
  disposition: Disposition;
  label: string;
  source: SourceRef;
  sourceRefs: SourceRef[];
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

interface ImportSources {
  subGoals: SubGoalSource[];
  projects: ProjectSource[];
  tasks: TaskSource[];
  members: MemberSource[];
}

interface ImportReport {
  sources: ImportSources;
  keys: ExistingKey[];
  subGoalGroups: SourceGroup<SubGoalSource>[];
  taskGroups: SourceGroup<TaskSource>[];
  subGoals: ReconciliationRecord[];
  unmatchedExistingSubGoals: ExistingSubGoal[];
  projects: ReconciliationRecord[];
  tasks: ReconciliationRecord[];
  members: ReconciliationRecord[];
  zohoMappings: ReconciliationRecord[];
}

interface ApplyStats {
  subGoalsInserted: number;
  subGoalsReconciled: number;
  subGoalsReactivated: number;
  subGoalsExisting: number;
  subGoalsSkipped: number;
  tasksInserted: number;
  tasksReconciled: number;
  tasksReactivated: number;
  tasksExisting: number;
  tasksSkipped: number;
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

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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

export function normalize(value: string): string {
  return compact(value)
    .normalize("NFKC")
    .replace(/[\u2013\u2014]/g, "-")
    .toLocaleUpperCase("en-IN");
}

function comparisonFingerprint(value: string): string {
  return normalize(value).replace(/[^A-Z0-9]+/g, "");
}

function comparisonTokens(value: string): Set<string> {
  return new Set(
    normalize(value)
      .replace(/[^A-Z0-9]+/g, " ")
      .split(" ")
      .filter(Boolean),
  );
}

/**
 * Conservative bridge for manually shortened Sub Goals. Exact normalized
 * description evidence is preferred. A high-overlap fallback handles small,
 * obvious wording changes such as replacing a list of names with "Team".
 */
export function isConfidentSubGoalReconciliation(
  existingTitle: string,
  existingDescription: string | null,
  stopSubGoalTitle: string,
): boolean {
  const sourceFingerprint = comparisonFingerprint(stopSubGoalTitle);
  const sourceTokens = comparisonTokens(stopSubGoalTitle);
  const evidence = [
    existingTitle,
    existingDescription ?? "",
    `${existingTitle} ${existingDescription ?? ""}`,
  ].filter(Boolean);

  return evidence.some((value) => {
    const evidenceFingerprint = comparisonFingerprint(value);
    if (evidenceFingerprint === sourceFingerprint) return true;

    const evidenceTokens = comparisonTokens(value);
    const common = [...evidenceTokens].filter((token) => sourceTokens.has(token)).length;
    const smallerTokenCount = Math.min(evidenceTokens.size, sourceTokens.size);
    const unionCount = new Set([...evidenceTokens, ...sourceTokens]).size;

    return common >= 5
      && smallerTokenCount > 0
      && common / smallerTokenCount >= 0.8
      && unionCount > 0
      && common / unionCount >= 0.55;
  });
}

export type TaskMatchStrategy = "EXACT" | "CANONICAL_ALIAS" | "NONE";

export function taskMatchStrategy(
  existingCategory: string,
  existingTitle: string,
  sourceCategory: string,
  sourceTitle: string,
): TaskMatchStrategy {
  if (normalize(existingCategory) !== normalize(sourceCategory)) return "NONE";
  if (normalize(existingTitle) === normalize(sourceTitle)) return "EXACT";

  if (
    normalize(sourceCategory) === "CGI"
    && normalize(sourceTitle) === "MODELING"
    && normalize(existingTitle) === "MODELLING"
  ) {
    return "CANONICAL_ALIAS";
  }

  return "NONE";
}

function sourceLabel(source: SourceRef): string {
  return `${source.file} :: ${source.sheet}!${source.row}`;
}

function workbookPath(candidates: readonly string[]): string {
  for (const file of candidates) {
    const filePath = path.join(process.cwd(), "imports", file);
    if (fs.existsSync(filePath)) return filePath;
  }
  throw new Error(
    `Workbook not found. Looked for: ${candidates.map((file) => path.join(process.cwd(), "imports", file)).join(", ")}`,
  );
}

function getWorksheet(workbook: ExcelJS.Workbook, expectedName: string): ExcelJS.Worksheet {
  const expected = normalize(expectedName);
  const worksheet = workbook.worksheets.find((candidate) => normalize(candidate.name) === expected);
  if (!worksheet) throw new Error(`Worksheet not found: ${expectedName}`);
  return worksheet;
}

function uniqueText(values: Array<string | null>): string | null {
  const unique = new Map<string, string>();
  for (const value of values) {
    const cleaned = compact(value ?? "");
    if (cleaned && !unique.has(normalize(cleaned))) unique.set(normalize(cleaned), cleaned);
  }
  return unique.size ? [...unique.values()].join("\n\n") : null;
}

function subGoalParts(columnA: string, columnB: string): {
  sourceCode: string;
  keyCode: KeyCode;
  title: string;
} | null {
  const match = columnA.match(
    /^\s*([ABC])\s*(\d+)\b\s*(?:[-:.\u2013\u2014]\s*)?(.*?)\s*$/i,
  );
  if (!match) return null;

  const letter = match[1].toUpperCase() as "A" | "B" | "C";
  const inlineTitle = compact(match[3] ?? "");
  return {
    sourceCode: `${letter} ${Number(match[2])}`,
    keyCode: `KEY_${letter}`,
    title: inlineTitle || compact(columnB),
  };
}

export function parseSubGoalsWorksheet(
  worksheet: ExcelJS.Worksheet,
  fileName: string,
): SubGoalSource[] {
  const records: SubGoalSource[] = [];

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const columnA = cellText(row.getCell(1));
    const columnB = cellText(row.getCell(2));
    const columnC = cellText(row.getCell(3));
    const parsed = subGoalParts(columnA, columnB);
    if (!parsed) continue;

    const description = uniqueText(
      [columnB, columnC].filter((value) => normalize(value) !== normalize(parsed.title)),
    );
    records.push({
      file: fileName,
      sheet: worksheet.name.trim(),
      row: rowNumber,
      keyCode: parsed.keyCode,
      sourceCode: parsed.sourceCode,
      title: parsed.title,
      description,
      validationError: parsed.title
        ? null
        : "The spreadsheet row has an explicit sub-goal code but no title in Column A or Column B.",
    });
  }
  return records;
}

export async function readSubGoals(filePath: string): Promise<SubGoalSource[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return SUB_GOAL_SHEETS.flatMap((sheetName) =>
    parseSubGoalsWorksheet(getWorksheet(workbook, sheetName), path.basename(filePath)),
  );
}

function parseProjectJobNumber(
  masterJobNo: string,
): Omit<ProjectSource, keyof SourceRef | "projectType"> {
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

export function parseTasksWorksheet(
  worksheet: ExcelJS.Worksheet,
  fileName: string,
): TaskSource[] {
  const records: TaskSource[] = [];
  let category = "";

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    category = cellText(row.getCell(1)) || category;
    const title = cellText(row.getCell(2));
    // Category-only rows (for example, Sales) are context and are not tasks.
    if (!title) continue;

    let validationError: string | null = null;
    if (!category) validationError = "The task has a title but no category to carry forward.";
    else if (category.length > 100) {
      validationError = `The category is ${category.length} characters; task_master.category allows 100.`;
    } else if (title.length > 300) {
      validationError = `The task title is ${title.length} characters; task_master.title allows 300.`;
    }
    records.push({
      file: fileName,
      sheet: worksheet.name.trim(),
      row: rowNumber,
      category,
      title,
      validationError,
    });
  }
  return records;
}

export async function readTasks(filePath: string): Promise<TaskSource[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return parseTasksWorksheet(getWorksheet(workbook, "Task Type"), path.basename(filePath));
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
  // PoolClient runs one query at a time. Keep the snapshot inside one transaction.
  const keys = await client.query<ExistingKey>(
    `SELECT id, code, title FROM assignment_keys ORDER BY code`,
  );
  const subGoals = await client.query<ExistingSubGoal>(
    `SELECT sg.id, sg.key_id, ak.code AS key_code, sg.title, sg.description, sg.is_active
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

function groupSources<T extends SourceRef>(
  records: T[],
  identity: (record: T) => string,
): SourceGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const record of records) {
    const key = identity(record);
    groups.set(key, [...(groups.get(key) ?? []), record]);
  }
  return [...groups].map(([key, groupedRecords]) => ({
    identity: key,
    canonical: groupedRecords[0],
    records: groupedRecords,
  }));
}

export function groupSubGoals(records: SubGoalSource[]): SourceGroup<SubGoalSource>[] {
  return groupSources(
    records.filter((record) => !record.validationError),
    (record) => `${record.keyCode}\u0000${normalize(record.title)}`,
  );
}

function groupTasks(records: TaskSource[]): SourceGroup<TaskSource>[] {
  return groupSources(
    records.filter((record) => !record.validationError),
    (record) => `${normalize(record.category)}\u0000${normalize(record.title)}`,
  );
}

function projectCandidates(
  source: ProjectSource,
  existing: ExistingProject[],
): { strategy: string; candidates: ExistingProject[] } {
  const strategies: Array<[string, (project: ExistingProject) => boolean]> = [
    [
      "normalized master Job No.",
      (project) => normalize(project.master_job_no ?? "") === normalize(source.masterJobNo),
    ],
    ["exact project code", (project) => compact(project.code ?? "") === compact(source.code)],
    ["normalized project code", (project) => normalize(project.code ?? "") === normalize(source.code)],
    ["normalized project name", (project) => normalize(project.name) === normalize(source.name)],
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

type SubGoalMatchStrategy = "EXACT_TITLE" | "TITLE_DESCRIPTION" | "NONE";

interface SubGoalResolution {
  group: SourceGroup<SubGoalSource>;
  keys: ExistingKey[];
  candidates: ExistingSubGoal[];
  strategy: SubGoalMatchStrategy;
  sharedCandidate: boolean;
}

function resolveSubGoalGroups(
  groups: SourceGroup<SubGoalSource>[],
  snapshot: DatabaseSnapshot,
): SubGoalResolution[] {
  const preliminary = groups.map((group): SubGoalResolution => {
    const source = group.canonical;
    const keys = snapshot.keys.filter((key) => normalize(key.code) === source.keyCode);
    if (keys.length !== 1) {
      return { group, keys, candidates: [], strategy: "NONE", sharedCandidate: false };
    }

    const underKey = snapshot.subGoals.filter((subGoal) => subGoal.key_id === keys[0].id);
    const exact = underKey.filter(
      (subGoal) => normalize(subGoal.title) === normalize(source.title),
    );
    if (exact.length) {
      return {
        group,
        keys,
        candidates: exact,
        strategy: "EXACT_TITLE",
        sharedCandidate: false,
      };
    }

    const reconciled = underKey.filter((subGoal) => isConfidentSubGoalReconciliation(
      subGoal.title,
      subGoal.description,
      source.title,
    ));
    return {
      group,
      keys,
      candidates: reconciled,
      strategy: reconciled.length ? "TITLE_DESCRIPTION" : "NONE",
      sharedCandidate: false,
    };
  });

  const claims = new Map<string, number>();
  for (const resolution of preliminary) {
    if (resolution.candidates.length === 1) {
      const id = resolution.candidates[0].id;
      claims.set(id, (claims.get(id) ?? 0) + 1);
    }
  }

  return preliminary.map((resolution) => ({
    ...resolution,
    sharedCandidate: resolution.candidates.length === 1
      && (claims.get(resolution.candidates[0].id) ?? 0) > 1,
  }));
}

function reconcileSubGoals(
  resolutions: SubGoalResolution[],
): ReconciliationRecord[] {
  return resolutions.map((resolution) => {
    const { group, keys, candidates, strategy, sharedCandidate } = resolution;
    const source = group.canonical;
    const label = `${source.keyCode} → ${source.title}`;
    if (keys.length !== 1) {
      return {
        status: keys.length ? "AMBIGUOUS" : "UNMATCHED",
        disposition: "SKIP",
        label,
        source,
        sourceRefs: group.records,
        matches: keys.map((key) => `${key.code} (${key.id})`),
        note: keys.length
          ? "More than one database key matched; no key or sub-goal will be changed."
          : "The required global key does not exist; the importer will not create it.",
      };
    }

    if (candidates.length > 1 || sharedCandidate) {
      return {
        status: "AMBIGUOUS",
        disposition: "SKIP",
        label,
        source,
        sourceRefs: group.records,
        matches: candidates.map((match) => `${match.title} (${match.id})`),
        note: sharedCandidate
          ? "One existing Sub Goal confidently matched more than one STOP Sub Goal; it will remain unchanged for review."
          : "Multiple database Sub Goals confidently match this STOP Sub Goal; none will be changed.",
      };
    }

    const match = candidates[0];
    const reconciled = Boolean(match && strategy === "TITLE_DESCRIPTION");
    return {
      status: match ? "MATCHED" : "UNMATCHED",
      disposition: match ? (reconciled ? "RECONCILE" : "EXISTING") : "INSERT",
      label,
      source,
      sourceRefs: group.records,
      matches: match
        ? [`${match.title} (${match.id}; ${match.is_active ? "active" : "archived"})`]
        : [],
      note: reconciled
        ? "Confident match from the existing title/description to the STOP full Sub Goal text; --apply will preserve this ID and canonicalize its title."
        : match
          ? `Matched by global key and normalized title; ${match.is_active ? "the existing row will be preserved" : "--apply will reactivate it"}.`
          : "No existing Sub Goal confidently matches; --apply will insert one row.",
      localId: match?.id,
    };
  });
}

function reconcileProjects(
  sources: ProjectSource[],
  snapshot: DatabaseSnapshot,
): ReconciliationRecord[] {
  return groupSources(sources, (source) => normalize(source.masterJobNo)).map((group) => {
    const source = group.canonical;
    const result = projectCandidates(source, snapshot.projects);
    const status: MatchStatus = result.candidates.length === 1
      ? "MATCHED"
      : result.candidates.length > 1
        ? "AMBIGUOUS"
        : "UNMATCHED";
    return {
      status,
      disposition: status === "MATCHED" ? "READ_ONLY_MATCH" : "SKIP",
      label: `${source.masterJobNo} → ${source.name}`,
      source,
      sourceRefs: group.records,
      matches: result.candidates.map(projectMatchLabel),
      note: status === "MATCHED"
        ? `Matched by ${result.strategy}; local ID, department, Zoho mapping, and project data are preserved.`
        : status === "AMBIGUOUS"
          ? `More than one existing project matched by ${result.strategy}; no project was selected or changed.`
          : "No existing project matched; the importer will not create or move a project.",
      localId: status === "MATCHED" ? result.candidates[0].id : undefined,
    };
  });
}

function reconcileTasks(
  groups: SourceGroup<TaskSource>[],
  snapshot: DatabaseSnapshot,
): ReconciliationRecord[] {
  return groups.map((group) => {
    const source = group.canonical;
    const exact = snapshot.tasks.filter((task) => (
      taskMatchStrategy(task.category, task.title, source.category, source.title) === "EXACT"
    ));
    const aliases = exact.length ? [] : snapshot.tasks.filter((task) => (
      taskMatchStrategy(task.category, task.title, source.category, source.title)
        === "CANONICAL_ALIAS"
    ));
    const strategy: TaskMatchStrategy = exact.length
      ? "EXACT"
      : aliases.length
        ? "CANONICAL_ALIAS"
        : "NONE";
    const matches = exact.length ? exact : aliases;
    if (matches.length > 1) {
      return {
        status: "AMBIGUOUS",
        disposition: "SKIP",
        label: `${source.category} → ${source.title}`,
        source,
        sourceRefs: group.records,
        matches: matches.map((task) => `${task.category} → ${task.title} (${task.id})`),
        note: "Multiple task_master rows match the canonical category/title; none will be changed.",
      };
    }

    const match = matches[0];
    return {
      status: match ? "MATCHED" : "UNMATCHED",
      disposition: match
        ? strategy === "CANONICAL_ALIAS" ? "RECONCILE" : "EXISTING"
        : "INSERT",
      label: `${source.category} → ${source.title}`,
      source,
      sourceRefs: group.records,
      matches: match
        ? [`${match.category} → ${match.title} (${match.id}; ${match.is_active ? "active" : "archived"})`]
        : [],
      note: strategy === "CANONICAL_ALIAS"
        ? "Matched the CGI Modelling alias; --apply will preserve this ID and rename it to canonical Modeling."
        : match
          ? `Matched by normalized category/title; ${match.is_active ? "the existing row will be preserved" : "--apply will reactivate it"}.`
        : "No task_master row matches; --apply will insert one row.",
      localId: match?.id,
    };
  });
}

function reconcileMembers(
  sources: MemberSource[],
  snapshot: DatabaseSnapshot,
): ReconciliationRecord[] {
  return groupSources(sources, (source) => normalize(source.name)).map((group) => {
    const source = group.canonical;
    const matches = snapshot.members.filter((member) => normalize(member.name) === normalize(source.name));
    const status: MatchStatus = matches.length === 1
      ? "MATCHED"
      : matches.length > 1
        ? "AMBIGUOUS"
        : "UNMATCHED";
    return {
      status,
      disposition: status === "MATCHED" ? "READ_ONLY_MATCH" : "SKIP",
      label: `${source.name} [${source.department || "no department"}]`,
      source,
      sourceRefs: group.records,
      matches: matches.map(
        (member) => `${member.name} (${member.id}; ${member.is_active ? "active" : "inactive"}; Zoho user ${member.zoho_user_id ?? "not mapped"})`,
      ),
      note: status === "MATCHED"
        ? "Matched by normalized name; the existing member ID and all member data are preserved."
        : status === "AMBIGUOUS"
          ? "Multiple existing members have this normalized name; none was selected or changed."
          : "No existing member matched; the importer will not create one.",
      localId: status === "MATCHED" ? matches[0].id : undefined,
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
  const zohoIdCounts = new Map<string, number>();
  for (const mapping of snapshot.zohoMappings) {
    const id = zohoId(mapping);
    if (!id) continue;
    const normalizedId = normalize(id);
    zohoIdCounts.set(normalizedId, (zohoIdCounts.get(normalizedId) ?? 0) + 1);
  }

  return projectRecords.map((project) => {
    if (project.status !== "MATCHED" || !project.localId) {
      return {
        status: project.status,
        disposition: "SKIP",
        label: project.label,
        source: project.source,
        sourceRefs: project.sourceRefs,
        matches: [],
        note: "A Zoho mapping cannot be reconciled without one unambiguous existing-project match.",
      };
    }

    const mappings = snapshot.zohoMappings.filter((mapping) => mapping.local_id === project.localId);
    const validMappings = mappings.filter((mapping) => zohoId(mapping));
    const hasSharedZohoId = validMappings.some(
      (mapping) => (zohoIdCounts.get(normalize(zohoId(mapping) ?? "")) ?? 0) > 1,
    );
    const status: MatchStatus = validMappings.length === 1 && !hasSharedZohoId
      ? "MATCHED"
      : validMappings.length > 1 || hasSharedZohoId
        ? "AMBIGUOUS"
        : "UNMATCHED";
    return {
      status,
      disposition: status === "MATCHED" ? "READ_ONLY_MATCH" : "SKIP",
      label: project.label,
      source: project.source,
      sourceRefs: project.sourceRefs,
      matches: mappings.map(
        (mapping) => `local ${mapping.local_id} → Zoho ${zohoId(mapping) ?? "blank"} (${mapping.sync_status ?? "no status"})`,
      ),
      note: status === "MATCHED"
        ? "Existing Zoho project mapping found; it is preserved and continues to resolve the same local project assignments."
        : status === "AMBIGUOUS"
          ? "Multiple or shared Zoho mappings need review; none will be changed."
          : mappings.length
            ? "Only blank Zoho mapping rows were found; none will be changed."
            : "The project has no existing Zoho project mapping; none will be inferred from Excel.",
    };
  });
}

function buildReport(sources: ImportSources, snapshot: DatabaseSnapshot): ImportReport {
  const subGoalGroups = groupSubGoals(sources.subGoals);
  const taskGroups = groupTasks(sources.tasks);
  const subGoalResolutions = resolveSubGoalGroups(subGoalGroups, snapshot);
  const matchedExistingSubGoalIds = new Set(
    subGoalResolutions
      .filter((resolution) => (
        resolution.keys.length === 1
        && resolution.candidates.length === 1
        && !resolution.sharedCandidate
      ))
      .map((resolution) => resolution.candidates[0].id),
  );
  const projects = reconcileProjects(sources.projects, snapshot);
  return {
    sources,
    keys: snapshot.keys,
    subGoalGroups,
    taskGroups,
    subGoals: reconcileSubGoals(subGoalResolutions),
    unmatchedExistingSubGoals: snapshot.subGoals.filter(
      (subGoal) => !matchedExistingSubGoalIds.has(subGoal.id),
    ),
    projects,
    tasks: reconcileTasks(taskGroups, snapshot),
    members: reconcileMembers(sources.members, snapshot),
    zohoMappings: reconcileZohoMappings(projects, snapshot),
  };
}

function countStatus(records: ReconciliationRecord[], status: MatchStatus): number {
  return records.filter((record) => record.status === status).length;
}

function printSummary(report: ImportReport): void {
  const validSubGoals = report.sources.subGoals.filter((source) => !source.validationError);
  const blankSubGoals = report.sources.subGoals.filter((source) => source.validationError);
  const duplicateSubGoals = report.subGoalGroups.filter((group) => group.records.length > 1);
  const validTasks = report.sources.tasks.filter((source) => !source.validationError);
  const invalidTasks = report.sources.tasks.filter((source) => source.validationError);
  const longestSubGoalTitle = Math.max(0, ...validSubGoals.map((source) => source.title.length));
  const uniqueSubGoalIdentities = new Set(report.subGoalGroups.map((group) => group.identity));
  const uniqueTaskIdentities = new Set(report.taskGroups.map((group) => group.identity));

  console.log("");
  console.log("=== REQUIRED DRY-RUN SUMMARY ===");
  console.log(`Keys in database: ${report.keys.length}`);
  console.log(`Operation Sub Goals detected: ${validSubGoals.filter((source) => normalize(source.sheet) === "OPERATION").length}`);
  console.log(`Management Sub Goals detected: ${validSubGoals.filter((source) => normalize(source.sheet) === "MANAGEMENT").length}`);
  console.log(`blank Sub Goals skipped: ${blankSubGoals.length}`);
  console.log(`duplicate Sub Goals: ${duplicateSubGoals.length} normalized groups (${duplicateSubGoals.reduce((total, group) => total + group.records.length, 0)} source rows)`);
  console.log(`Unique Sub Goals: ${report.subGoalGroups.length}`);
  console.log(`Duplicate canonical Key + normalized Sub Goal identities: ${report.subGoalGroups.length - uniqueSubGoalIdentities.size}`);
  console.log(`Longest populated Sub Goal title: ${longestSubGoalTitle} characters`);
  console.log(`Sub Goals to insert: ${report.subGoals.filter((record) => record.disposition === "INSERT").length}`);
  console.log(`Sub Goals to reconcile with preserved IDs: ${report.subGoals.filter((record) => record.disposition === "RECONCILE").length}`);
  console.log(`Existing Sub Goals unmatched to STOP: ${report.unmatchedExistingSubGoals.length}`);
  console.log(`Tasks detected: ${validTasks.length}`);
  console.log(`Unique canonical Tasks: ${report.taskGroups.length}`);
  console.log(`Duplicate canonical category + normalized Task identities: ${report.taskGroups.length - uniqueTaskIdentities.size}`);
  console.log(`Tasks to insert: ${report.tasks.filter((record) => record.disposition === "INSERT").length}`);
  console.log(`Tasks to reconcile with preserved IDs: ${report.tasks.filter((record) => record.disposition === "RECONCILE").length}`);
  console.log(`Tasks already existing: ${report.tasks.filter((record) => record.disposition === "EXISTING").length}`);
  console.log(`invalid task rows skipped: ${invalidTasks.length}`);
  console.log(`Projects matched/unmatched/ambiguous: ${countStatus(report.projects, "MATCHED")}/${countStatus(report.projects, "UNMATCHED")}/${countStatus(report.projects, "AMBIGUOUS")}`);
  console.log(`Members matched/unmatched: ${countStatus(report.members, "MATCHED")}/${countStatus(report.members, "UNMATCHED")}`);
  console.log(`Members ambiguous: ${countStatus(report.members, "AMBIGUOUS")}`);
  console.log(`Zoho project mappings matched/unmatched/ambiguous: ${countStatus(report.zohoMappings, "MATCHED")}/${countStatus(report.zohoMappings, "UNMATCHED")}/${countStatus(report.zohoMappings, "AMBIGUOUS")}`);
}

function printDetectedSubGoals(title: string, sources: SubGoalSource[]): void {
  console.log("");
  console.log(`=== ${title} ===`);
  if (!sources.length) console.log("  (none)");
  for (const source of sources) {
    console.log(`  [${sourceLabel(source)}] ${source.sourceCode} → ${source.title}`);
  }
}

function printBlankSubGoals(sources: SubGoalSource[]): void {
  console.log("");
  console.log("=== BLANK SUB GOALS SKIPPED ===");
  if (!sources.length) console.log("  (none)");
  for (const source of sources) {
    console.log(`  [${sourceLabel(source)}] ${source.sourceCode}: ${source.validationError}`);
  }
}

function printDuplicateSubGoals(groups: SourceGroup<SubGoalSource>[]): void {
  console.log("");
  console.log("=== DUPLICATE SUB GOALS (KEY + NORMALIZED TITLE) ===");
  if (!groups.length) console.log("  (none)");
  for (const group of groups) {
    console.log(`  ${group.canonical.keyCode} → ${group.canonical.title}`);
    group.records.forEach((source) => console.log(`    ↳ ${sourceLabel(source)}`));
  }
}

function printUnmatchedExistingSubGoals(subGoals: ExistingSubGoal[]): void {
  console.log("");
  console.log("=== EXISTING SUB GOALS UNMATCHED TO STOP ===");
  if (!subGoals.length) console.log("  (none)");
  for (const subGoal of subGoals) {
    console.log(
      `  ${subGoal.key_code} → ${subGoal.title} (${subGoal.id}; ${subGoal.is_active ? "active" : "archived"})`,
    );
    if (subGoal.description) console.log(`    Description: ${subGoal.description}`);
    console.log("    No confident one-to-one STOP match; this existing record remains untouched.");
  }
}

function printSection(title: string, records: ReconciliationRecord[]): void {
  console.log("");
  console.log(`=== ${title} ===`);
  console.log(
    `TOTAL ${records.length} | MATCHED ${countStatus(records, "MATCHED")} | UNMATCHED ${countStatus(records, "UNMATCHED")} | AMBIGUOUS ${countStatus(records, "AMBIGUOUS")}`,
  );
  for (const status of ["MATCHED", "UNMATCHED", "AMBIGUOUS"] as const) {
    console.log(`-- ${status} --`);
    const statusRecords = records.filter((record) => record.status === status);
    if (!statusRecords.length) console.log("  (none)");
    for (const record of statusRecords) {
      console.log(`  [${sourceLabel(record.source)}] ${record.label}`);
      if (record.sourceRefs.length > 1) {
        console.log(`    Source rows: ${record.sourceRefs.map((source) => `${source.sheet}!${source.row}`).join(", ")}`);
      }
      console.log(`    ${record.note}`);
      record.matches.forEach((match) => console.log(`    ↳ ${match}`));
    }
  }
}

function printInvalidTasks(sources: TaskSource[]): void {
  console.log("");
  console.log("=== INVALID TASK ROWS SKIPPED ===");
  if (!sources.length) console.log("  (none)");
  for (const source of sources) {
    console.log(`  [${sourceLabel(source)}] ${source.category || "(blank)"} → ${source.title}`);
    console.log(`    ${source.validationError}`);
  }
}

function printReport(report: ImportReport, apply: boolean): void {
  console.log("============================================================");
  console.log(`WORK PLANNING EXCEL IMPORT — ${apply ? "APPLY PLAN" : "DRY RUN"}`);
  console.log(apply
    ? "Only assignment_sub_goals and task_master may be inserted, updated, or reactivated."
    : "READ-ONLY: the PostgreSQL transaction is READ ONLY and will be rolled back.");
  console.log("Projects, members, departments, Zoho mappings, keys, and key_assignments are never written.");
  console.log("============================================================");

  printSummary(report);
  const validSubGoals = report.sources.subGoals.filter((source) => !source.validationError);
  printDetectedSubGoals(
    "OPERATION SUB GOALS DETECTED",
    validSubGoals.filter((source) => normalize(source.sheet) === "OPERATION"),
  );
  printDetectedSubGoals(
    "MANAGEMENT SUB GOALS DETECTED",
    validSubGoals.filter((source) => normalize(source.sheet) === "MANAGEMENT"),
  );
  printBlankSubGoals(report.sources.subGoals.filter((source) => source.validationError));
  printDuplicateSubGoals(report.subGoalGroups.filter((group) => group.records.length > 1));
  printSection("SUB GOAL DATABASE RECONCILIATION", report.subGoals);
  printUnmatchedExistingSubGoals(report.unmatchedExistingSubGoals);
  printSection("TASKS (CAC Projects Task Type → task_master)", report.tasks);
  printInvalidTasks(report.sources.tasks.filter((source) => source.validationError));
  printSection("PROJECTS (reconciliation only; never written)", report.projects);
  printSection("MEMBERS (reconciliation only; never written)", report.members);
  printSection("ZOHO PROJECT MAPPINGS (existing mappings only)", report.zohoMappings);

  console.log("");
  console.log("=== KEY ASSIGNMENTS ===");
  console.log("CREATED 0");
  console.log("No key_assignments are proposed or created. The existing Key → Sub Goal → Project → Task → Member → Start Date → End Date flow remains manual.");
}

function mergedGroupDescription(group: SourceGroup<SubGoalSource>): string | null {
  return uniqueText(group.records.map((record) => record.description));
}

async function assertSubGoalTitleCapacity(client: PoolClient, groups: SourceGroup<SubGoalSource>[]): Promise<void> {
  const longestTitle = Math.max(0, ...groups.map((group) => group.canonical.title.length));
  const result = await client.query<{ character_maximum_length: number | null }>(
    `SELECT character_maximum_length
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'assignment_sub_goals'
        AND column_name = 'title'`,
  );
  const maximum = result.rows[0]?.character_maximum_length ?? null;
  if (maximum !== null && longestTitle > maximum) {
    throw new Error(
      `The longest imported Sub Goal title is ${longestTitle} characters, but assignment_sub_goals.title allows ${maximum}. Apply database/023_work_planning_import_titles.sql first.`,
    );
  }
}

async function applySafeMasterData(
  client: PoolClient,
  report: ImportReport,
  snapshot: DatabaseSnapshot,
): Promise<ApplyStats> {
  await assertSubGoalTitleCapacity(client, report.subGoalGroups);
  const stats: ApplyStats = {
    subGoalsInserted: 0,
    subGoalsReconciled: 0,
    subGoalsReactivated: 0,
    subGoalsExisting: 0,
    subGoalsSkipped: report.sources.subGoals.filter((source) => source.validationError).length,
    tasksInserted: 0,
    tasksReconciled: 0,
    tasksReactivated: 0,
    tasksExisting: 0,
    tasksSkipped: report.sources.tasks.filter((source) => source.validationError).length,
  };

  for (const [index, group] of report.subGoalGroups.entries()) {
    const source = group.canonical;
    const plan = report.subGoals[index];
    if (plan.disposition === "SKIP") {
      stats.subGoalsSkipped += 1;
      continue;
    }

    const keys = snapshot.keys.filter((key) => normalize(key.code) === source.keyCode);
    if (keys.length !== 1) {
      stats.subGoalsSkipped += 1;
      continue;
    }

    const description = mergedGroupDescription(group);
    const existing = plan.localId
      ? snapshot.subGoals.find((subGoal) => subGoal.id === plan.localId)
      : undefined;
    if (existing) {
      if (plan.disposition === "RECONCILE") {
        await client.query(
          `UPDATE assignment_sub_goals
              SET title = $2,
                  description = $3,
                  is_active = TRUE
            WHERE id = $1`,
          [existing.id, source.title, description],
        );
        stats.subGoalsReconciled += 1;
      } else {
        await client.query(
          `UPDATE assignment_sub_goals
              SET title = $2,
                  description = CASE
                    WHEN NULLIF(BTRIM(description), '') IS NULL THEN $3
                    ELSE description
                  END,
                  is_active = TRUE
            WHERE id = $1`,
          [existing.id, source.title, description],
        );
        if (existing.is_active) stats.subGoalsExisting += 1;
        else stats.subGoalsReactivated += 1;
      }
    } else if (plan.disposition === "INSERT") {
      await client.query(
        `INSERT INTO assignment_sub_goals (key_id, title, description, is_active)
         VALUES ($1, $2, $3, TRUE)`,
        [keys[0].id, source.title, description],
      );
      stats.subGoalsInserted += 1;
    } else {
      stats.subGoalsSkipped += 1;
    }
  }

  for (const [index, group] of report.taskGroups.entries()) {
    const source = group.canonical;
    const plan = report.tasks[index];
    if (plan.disposition === "SKIP") {
      stats.tasksSkipped += 1;
      continue;
    }

    const existing = plan.localId
      ? snapshot.tasks.find((task) => task.id === plan.localId)
      : undefined;
    if (existing) {
      await client.query(
        `UPDATE task_master
            SET category = $2,
                title = $3,
                is_active = TRUE
          WHERE id = $1`,
        [existing.id, source.category, source.title],
      );
      if (plan.disposition === "RECONCILE") stats.tasksReconciled += 1;
      else if (existing.is_active) stats.tasksExisting += 1;
      else stats.tasksReactivated += 1;
    } else if (plan.disposition === "INSERT") {
      await client.query(
        `INSERT INTO task_master (category, title, is_active)
         VALUES ($1, $2, TRUE)`,
        [source.category, source.title],
      );
      stats.tasksInserted += 1;
    } else {
      stats.tasksSkipped += 1;
    }
  }

  const verification = await readDatabaseSnapshot(client);
  for (const [index, group] of report.subGoalGroups.entries()) {
    if (report.subGoals[index].disposition === "SKIP") continue;
    const source = group.canonical;
    const keys = verification.keys.filter((key) => normalize(key.code) === source.keyCode);
    if (keys.length !== 1) continue;
    const matches = verification.subGoals.filter(
      (subGoal) => subGoal.key_id === keys[0].id
        && normalize(subGoal.title) === normalize(source.title)
        && subGoal.is_active,
    );
    if (matches.length !== 1) {
      throw new Error(`Post-apply verification failed for ${source.keyCode} → ${source.title}.`);
    }
  }

  for (const [index, group] of report.taskGroups.entries()) {
    if (report.tasks[index].disposition === "SKIP") continue;
    const source = group.canonical;
    const matches = verification.tasks.filter(
      (task) => normalize(task.category) === normalize(source.category)
        && normalize(task.title) === normalize(source.title)
        && task.is_active,
    );
    if (matches.length !== 1) {
      throw new Error(`Post-apply verification failed for ${source.category} → ${source.title}.`);
    }
  }
  return stats;
}

function printApplyStats(stats: ApplyStats): void {
  console.log("");
  console.log("============================================================");
  console.log("SAFE MASTER DATA IMPORT COMMITTED");
  console.log("============================================================");
  console.log(`Sub Goals inserted: ${stats.subGoalsInserted}`);
  console.log(`Sub Goals reconciled with preserved IDs: ${stats.subGoalsReconciled}`);
  console.log(`Sub Goals reactivated: ${stats.subGoalsReactivated}`);
  console.log(`Sub Goals already existing: ${stats.subGoalsExisting}`);
  console.log(`Sub Goals skipped: ${stats.subGoalsSkipped}`);
  console.log(`Tasks inserted: ${stats.tasksInserted}`);
  console.log(`Tasks reconciled with preserved IDs: ${stats.tasksReconciled}`);
  console.log(`Tasks reactivated: ${stats.tasksReactivated}`);
  console.log(`Tasks already existing: ${stats.tasksExisting}`);
  console.log(`Tasks skipped: ${stats.tasksSkipped}`);
  console.log("Projects changed: 0");
  console.log("Members changed: 0");
  console.log("Zoho mappings changed: 0");
  console.log("Key assignments created: 0");
}

async function readImportSources(): Promise<ImportSources> {
  const stopPath = workbookPath(FILES.stop);
  const projectsPath = workbookPath(FILES.projects);
  const membersPath = workbookPath(FILES.members);
  const [subGoals, projects, tasks, members] = await Promise.all([
    readSubGoals(stopPath),
    readProjects(projectsPath),
    readTasks(projectsPath),
    readMembers(membersPath),
  ]);
  return { subGoals, projects, tasks, members };
}

async function run(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const unknownArguments = process.argv.slice(2).filter((argument) => argument !== "--apply");
  if (unknownArguments.length) throw new Error(`Unknown argument(s): ${unknownArguments.join(", ")}`);

  loadLocalEnvironment();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");

  const sources = await readImportSources();
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
    max: 1,
    application_name: apply ? "work-planning-safe-master-import" : "work-planning-import-dry-run",
  });

  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query(apply ? "BEGIN" : "BEGIN TRANSACTION READ ONLY");
    transactionOpen = true;
    const snapshot = await readDatabaseSnapshot(client);
    const report = buildReport(sources, snapshot);
    printReport(report, apply);

    if (apply) {
      const stats = await applySafeMasterData(client, report, snapshot);
      await client.query("COMMIT");
      transactionOpen = false;
      printApplyStats(stats);
    } else {
      await client.query("ROLLBACK");
      transactionOpen = false;
      console.log("");
      console.log("Dry-run complete. No database changes were made.");
      console.log("Run `npm run work-planning:import -- --apply` to apply only Sub Goals and Task Master data.");
    }
  } finally {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error("Work Planning import failed:", error);
    process.exitCode = 1;
  });
}
