import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

const STOP_FILE = "STOP -CAC 26_27.xlsx";
const TEAM_ALIGNMENT_FILE = "Team Alignment.xlsx";
const STOP_SHEETS = ["Operation", "Management"] as const;
const EXPECTED_KEYS = ["KEY_A", "KEY_B", "KEY_C"] as const;
const FISCAL_YEAR_START = Date.UTC(2026, 3, 1);
const FISCAL_YEAR_END = Date.UTC(2027, 2, 31);

export type KeyCode = typeof EXPECTED_KEYS[number];
export type AssignmentStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "DONE"
  | "ON_HOLD"
  | "CANCELLED";
export type ProblemReason =
  | "unmatched_project"
  | "ambiguous_project"
  | "unmatched_member"
  | "unmatched_task"
  | "unmatched_sub_goal"
  | "missing_invalid_date";

export interface TeamAlignmentMember {
  name: string;
  team: string;
  sourceRow: number;
}

export interface ExistingKey extends QueryResultRow {
  id: string;
  code: KeyCode;
  title: string;
}

export interface ExistingSubGoal extends QueryResultRow {
  id: string;
  key_id: string;
  key_code: KeyCode;
  title: string;
  is_active: boolean;
}

export interface ExistingProject extends QueryResultRow {
  id: string;
  name: string;
  code: string | null;
  master_job_no: string | null;
  client_name: string | null;
  is_active: boolean;
}

export interface ExistingTask extends QueryResultRow {
  id: string;
  category: string;
  title: string;
  is_active: boolean;
}

export interface ExistingMember extends QueryResultRow {
  id: string;
  name: string;
  team: string | null;
  is_active: boolean;
}

export interface DatabaseSnapshot {
  keys: ExistingKey[];
  subGoals: ExistingSubGoal[];
  projects: ExistingProject[];
  tasks: ExistingTask[];
  members: ExistingMember[];
}

export interface HistoricalWorkSource {
  file: string;
  sheet: string;
  row: number;
  cell: string;
  statusCell: string;
  sourceMember: string | null;
  sourceCode: string;
  keyCode: KeyCode;
  subGoalTitle: string;
  activity: string;
  workDate: string | null;
  rawStatus: string | null;
  status: AssignmentStatus | null;
}

interface Match<T> {
  record: T | null;
  strategy: string;
  candidates: T[];
  sourceLabel: string;
}

export interface HistoricalAssignmentResolution {
  source: HistoricalWorkSource;
  key: ExistingKey | null;
  subGoal: ExistingSubGoal | null;
  project: ExistingProject | null;
  projectStrategy: string;
  task: ExistingTask | null;
  taskStrategy: string;
  member: ExistingMember | null;
  memberStrategy: string;
  memberTeam: string | null;
  startDate: string | null;
  endDate: string | null;
  status: AssignmentStatus | null;
  problems: ProblemReason[];
  projectCandidates: string[];
}

export interface CountedLabel {
  label: string;
  count: number;
  reasons?: string[];
}

export interface HistoricalAssignmentReport {
  rows: HistoricalAssignmentResolution[];
  summary: {
    totalSourceWorkRows: number;
    fullyMatchedRows: number;
    unmatchedProject: number;
    ambiguousProject: number;
    unmatchedMember: number;
    unmatchedTask: number;
    unmatchedSubGoal: number;
    missingInvalidDate: number;
    rowsWithMultipleProblems: number;
  };
  unresolvedProjects: CountedLabel[];
  unresolvedMembers: CountedLabel[];
  unmatchedTasks: CountedLabel[];
  unmatchedSubGoals: CountedLabel[];
}

interface ConfirmedProjectAlias {
  aliases: string[];
  targetEvidence: string;
}

const CONFIRMED_PROJECT_ALIASES: ConfirmedProjectAlias[] = [
  { aliases: ["SANTOOR"], targetEvidence: "SANTOOR FRESH SKIN" },
  { aliases: ["RIN"], targetEvidence: "RIN BB" },
  { aliases: ["URBANO"], targetEvidence: "TMRW/URBANO" },
  { aliases: ["TVS APACHE", "TVS"], targetEvidence: "TVS APACHE" },
  { aliases: ["FEDEX"], targetEvidence: "FEDEX TREATMENT NOTE" },
  { aliases: ["LEVIS"], targetEvidence: "LEVIS AWARD" },
  { aliases: ["GRT CALENDAR", "GRT CALENDER"], targetEvidence: "GRT CALENDER-2027" },
  { aliases: ["DEL MONTE"], targetEvidence: "DEL MONTE/DEL MONTE" },
  { aliases: ["STOA PARIS"], targetEvidence: "STOA PARIS" },
  { aliases: ["SUPER YOU", "SUPERYOU"], targetEvidence: "SUPERYOU POWER PUFFS" },
  { aliases: ["JSW PAINTS", "JSW"], targetEvidence: "JSW PAINTS WALL KV" },
  { aliases: ["SANSAAR BEDDING"], targetEvidence: "SANSAAR BEDDING KV" },
  { aliases: ["SLEEP COMPANY", "TSC DHONI"], targetEvidence: "TSC DHONI BEDROOM KV" },
  { aliases: ["OFFICER CHOICE", "OFFICER CHOISE"], targetEvidence: "OFFICER CHOISE CHANGES" },
  { aliases: ["SEASONS HEARTWOOD"], targetEvidence: "SEASONS HEARTWOOD" },
  { aliases: ["PHULLARA"], targetEvidence: "PHULLARA JWELLERY" },
  { aliases: ["CPRMND"], targetEvidence: "/CPRMND" },
  { aliases: ["WATCH STRAP"], targetEvidence: "WATCH STRAP CGI" },
  { aliases: ["ERTIGA"], targetEvidence: "MARUTI/ERTIGA" },
  { aliases: ["TITAN SIGNATURE"], targetEvidence: "TITAN SIGNATURE AUTOMATICS" },
  { aliases: ["VIVO T5 LITE"], targetEvidence: "VIVO/VIVO T5 LITE" },
  { aliases: ["VIVO V80"], targetEvidence: "VIVO/VIVO V80" },
  { aliases: ["AQUAGUARD WATER SOFTENER"], targetEvidence: "AQUAGUARD WATER SOFTENER" },
  { aliases: ["AQUAGUARD EXPRESS CARE"], targetEvidence: "AQUAGUARD EXPRESS CARE KV" },
  { aliases: ["AQUAGUARD WATER GLASS"], targetEvidence: "AQUAGUARD WATER GLASS" },
  { aliases: ["EUREKA FORBES ROBO"], targetEvidence: "EUREKA FORBES ROBO KV" },
  { aliases: ["SURF EXCEL MATIC"], targetEvidence: "SURF EXCEL MATIC - INR 10 KV" },
  { aliases: ["SURF EXCEL NON SOUTH"], targetEvidence: "SURF EXCEL NON SOUTH MMR KV" },
  { aliases: ["COLORPLUS AW26 CAMPAIGN CREATIVE"], targetEvidence: "COLORPLUS AW26 CAMPAIGN CRAETIVE" },
  { aliases: ["COLORPLUS AW26 CAMPAIGN SHOOT"], targetEvidence: "COLORPLUS AW26 CAMPAIGN SHOOT" },
  { aliases: ["BRANDING ILT"], targetEvidence: "BRANDING/ILT" },
  { aliases: ["PRODUCT LINE ILT"], targetEvidence: "PRODUCT LINE/ILT" },
  { aliases: ["PST ILT"], targetEvidence: "PST/ILT" },
  { aliases: ["SABYASACHI ILT", "SABHYASACHI"], targetEvidence: "SABYASACHI/ILT" },
  { aliases: ["LAYOUT DISTILLED EDIT"], targetEvidence: "LAYOUT/DISTILLED EDIT" },
  { aliases: ["TYPO GRID SYSTEM DISTILLED EDIT"], targetEvidence: "TYPO GRID SYSTEM/DISTILLED EDIT" },
  { aliases: ["CAC ARTIST DECODE"], targetEvidence: "CAC/ARTIST DECODE" },
  { aliases: ["CAC LEARNING"], targetEvidence: "CAC/LEARNING" },
  { aliases: ["BRANDING CAC"], targetEvidence: "BRANDING/CAC" },
  { aliases: ["MKT CAC"], targetEvidence: "MKT/CAC" },
];

const AMBIGUOUS_PROJECT_FAMILIES = [
  { label: "Surf Excel", aliases: ["SURF EXCEL"] },
  { label: "Aquaguard / Eureka Forbes", aliases: ["AQUAGUARD", "EUREKA FORBES"] },
  { label: "iQOO", aliases: ["IQOO"] },
  { label: "ILT", aliases: ["ILT"] },
  { label: "Raymond", aliases: ["RAYMOND"] },
  { label: "CAC", aliases: ["CAC"] },
  { label: "Distilled Edit", aliases: ["DISTILLED EDIT"] },
  { label: "Vivo", aliases: ["VIVO"] },
  { label: "Calmirize", aliases: ["CALMIRIZE"] },
] as const;

const MEMBER_ALIASES = new Map<string, string>([
  ["ABHIJIT", "ABHJIT JAMBHALE"],
  ["ABHIJIT JAMBHALE", "ABHJIT JAMBHALE"],
  ["TANVI KANGUTKAR", "TANVI KANGUTAKR"],
  ["TANVI KANGUTAKAR", "TANVI KANGUTAKR"],
  ["MAYURI BAGAVE", "MAYURI BHOGATE"],
  ["SHRADHA BACHKUL", "SHRADDHA BACHKUL"],
  ["AMISHA NETAKE", "AMISHA NETKE"],
  ["AKASH JANGAM", "AAKASH JANGAM"],
  ["YANA SAKPAL", "YAANA SAKPAL"],
]);

const NON_WORK_VALUES = new Set([
  "-",
  "D",
  "DONE",
  "NS",
  "NOT STARTED",
  "P",
  "PROGRESS",
  "IN PROGRESS",
  "ON HOLD",
  "CANCELLED",
  "CANCELED",
  "ABSENT FOR DAY",
  "ABSENT FOR MEETING",
  "WORK ON HOLIDAY",
  "APPROVED LEAVE",
  "HALF DAY",
  "LEAVE",
  "WEEKLY OFF",
]);

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

export function normalizeHistorical(value: string): string {
  return compact(value)
    .normalize("NFKC")
    .replace(/[\u2013\u2014]/g, "-")
    .toLocaleUpperCase("en-IN");
}

function searchable(value: string): string {
  return normalizeHistorical(value).replace(/[^A-Z0-9]+/g, " ").trim();
}

function cellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return compact(String(value));
  if ("richText" in value) return compact(value.richText.map((part) => part.text).join(""));
  if ("text" in value) {
    const hyperlinkText: unknown = (value as { text?: unknown }).text;
    if (typeof hyperlinkText === "string") return compact(hyperlinkText);
    if (
      hyperlinkText
      && typeof hyperlinkText === "object"
      && "richText" in hyperlinkText
      && Array.isArray((hyperlinkText as { richText?: unknown }).richText)
    ) {
      const richText = (hyperlinkText as { richText: Array<{ text: string }> }).richText;
      return compact(richText.map((part) => part.text).join(""));
    }
  }
  if ("result" in value && value.result !== null && value.result !== undefined) {
    return compact(String(value.result));
  }
  return typeof cell.text === "string" ? compact(cell.text) : "";
}

function dateIso(value: unknown): string | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  const utc = Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  if (utc < FISCAL_YEAR_START || utc > FISCAL_YEAR_END) return null;
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

export function normalizeStatus(value: string): AssignmentStatus | null {
  const normalized = normalizeHistorical(value).replace(/[^A-Z]+/g, " ").trim();
  if (["D", "DONE", "COMPLETED", "COMPLETE"].includes(normalized)) return "DONE";
  if (["P", "PROGRESS", "IN PROGRESS", "WIP"].includes(normalized)) return "IN_PROGRESS";
  if (["NS", "NOT STARTED", "NOTSTARTED"].includes(normalized)) return "NOT_STARTED";
  if (normalized === "ON HOLD") return "ON_HOLD";
  if (["CANCELLED", "CANCELED"].includes(normalized)) return "CANCELLED";
  return null;
}

function subGoalParts(columnA: string, columnB: string): {
  sourceCode: string;
  keyCode: KeyCode;
  title: string;
} | null {
  const match = columnA.match(/^\s*([ABC])\s*(\d+)\b\s*(?:[-:.\u2013\u2014]\s*)?(.*?)\s*$/i);
  if (!match) return null;
  const letter = match[1].toUpperCase() as "A" | "B" | "C";
  return {
    sourceCode: `${letter} ${Number(match[2])}`,
    keyCode: `KEY_${letter}`,
    title: compact(match[3] ?? "") || compact(columnB),
  };
}

function isIdentityRowBlank(row: ExcelJS.Row): boolean {
  return [1, 2, 3].every((column) => !cellText(row.getCell(column)));
}

function plausibleUnknownMember(value: string): boolean {
  const normalized = normalizeHistorical(value).replace(/\s*:\s*$/, "");
  if (!normalized || /\d/.test(normalized)) return false;
  const words = normalized.match(/[A-Z]+/g) ?? [];
  if (!words.length || words.length > 4) return false;
  return !/\b(KEY|OBJECTIVE|TASK|GOAL|JOB|EXECUTION|EXCUTION|DEPARTMENT|TEAM|PRODUCTION|POST|CGI|AI|RND|DOP|MOTION|EDITING|MARKETING|SALES|BUSINESS|CONTENT|CLIENT|ACCOUNT|OPERATION|ADMIN|MANAGEMENT|PROVISION|FUTURE|PORTFOLIO|CREATIVE|FINANCIAL|PROJECT|SHEET|DATA|BANKING|OFFICE|PERSONAL|COMPLIANCE|LEARNING|QUALITY|RESOURCE|BACKUP|VISUAL|SOCIAL|ENQUIRY|DRIVE|CLOSURE|INVESTMENT)\b/.test(normalized);
}

interface MemberNameResolution {
  canonicalName: string | null;
  strategy: string;
  ambiguous: boolean;
}

export function resolveTeamAlignmentName(
  sourceName: string,
  teamMembers: TeamAlignmentMember[],
): MemberNameResolution {
  const normalized = normalizeHistorical(sourceName).replace(/\s*:\s*$/, "");
  const exact = teamMembers.filter((member) => normalizeHistorical(member.name) === normalized);
  if (exact.length === 1) return { canonicalName: exact[0].name, strategy: "EXACT_TEAM_ALIGNMENT_NAME", ambiguous: false };
  if (exact.length > 1) return { canonicalName: null, strategy: "AMBIGUOUS_TEAM_ALIGNMENT_NAME", ambiguous: true };

  const aliasName = MEMBER_ALIASES.get(normalized);
  if (aliasName) {
    const aliasMatches = teamMembers.filter((member) => normalizeHistorical(member.name) === aliasName);
    if (aliasMatches.length === 1) return { canonicalName: aliasMatches[0].name, strategy: "CONFIRMED_MEMBER_ALIAS", ambiguous: false };
  }

  const sourceWords = searchable(normalized).split(" ").filter(Boolean);
  if (sourceWords.length === 1) {
    const firstNameMatches = teamMembers.filter(
      (member) => searchable(member.name).split(" ")[0] === sourceWords[0],
    );
    if (firstNameMatches.length === 1) {
      return { canonicalName: firstNameMatches[0].name, strategy: "UNIQUE_TEAM_ALIGNMENT_FIRST_NAME", ambiguous: false };
    }
    if (firstNameMatches.length > 1) {
      return { canonicalName: null, strategy: "AMBIGUOUS_TEAM_ALIGNMENT_FIRST_NAME", ambiguous: true };
    }
  }
  return { canonicalName: null, strategy: "NO_TEAM_ALIGNMENT_MATCH", ambiguous: false };
}

function findSourceMember(
  worksheet: ExcelJS.Worksheet,
  subGoalRow: number,
  teamMembers: TeamAlignmentMember[],
): string | null {
  let blankRun = 0;
  let unknownCandidate: string | null = null;
  for (let rowNumber = subGoalRow - 1; rowNumber >= Math.max(1, subGoalRow - 30); rowNumber -= 1) {
    const row = worksheet.getRow(rowNumber);
    if (isIdentityRowBlank(row)) {
      blankRun += 1;
      if (blankRun >= 2) break;
      continue;
    }
    blankRun = 0;
    const label = cellText(row.getCell(1));
    if (!label) continue;
    const resolution = resolveTeamAlignmentName(label, teamMembers);
    if (resolution.canonicalName || resolution.ambiguous) return label;
    if (!unknownCandidate && plausibleUnknownMember(label)) unknownCandidate = label;
  }
  return unknownCandidate;
}

export function isUsableActivity(value: string): boolean {
  const normalized = normalizeHistorical(value);
  return Boolean(normalized) && !NON_WORK_VALUES.has(normalized);
}

export async function readTeamAlignment(filePath: string): Promise<TeamAlignmentMember[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets.find((sheet) => normalizeHistorical(sheet.name) === "DATA SHEET");
  if (!worksheet) throw new Error("Team Alignment workbook has no Data Sheet worksheet.");
  const members: TeamAlignmentMember[] = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const name = cellText(worksheet.getRow(rowNumber).getCell(2));
    if (!name) continue;
    members.push({
      name,
      team: cellText(worksheet.getRow(rowNumber).getCell(7)),
      sourceRow: rowNumber,
    });
  }
  return members;
}

export async function readHistoricalWorkRows(
  stopFilePath: string,
  teamMembers: TeamAlignmentMember[],
): Promise<HistoricalWorkSource[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(stopFilePath);
  const records: HistoricalWorkSource[] = [];

  for (const sheetName of STOP_SHEETS) {
    const worksheet = workbook.worksheets.find((sheet) => normalizeHistorical(sheet.name) === normalizeHistorical(sheetName));
    if (!worksheet) throw new Error(`STOP workbook has no ${sheetName} worksheet.`);
    const dateColumns: Array<{ column: number; date: string | null }> = [];
    worksheet.getRow(1).eachCell({ includeEmpty: false }, (cell, column) => {
      if (cell.value instanceof Date) dateColumns.push({ column, date: dateIso(cell.value) });
    });

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const subGoal = subGoalParts(cellText(row.getCell(1)), cellText(row.getCell(2)));
      if (!subGoal) continue;
      let sourceMember: string | null | undefined;
      for (const dateColumn of dateColumns) {
        const activityCell = row.getCell(dateColumn.column);
        const activity = cellText(activityCell);
        if (!isUsableActivity(activity)) continue;
        if (sourceMember === undefined) {
          sourceMember = findSourceMember(worksheet, rowNumber, teamMembers);
        }
        const statusCell = row.getCell(dateColumn.column + 1);
        const rawStatus = cellText(statusCell) || null;
        records.push({
          file: path.basename(stopFilePath),
          sheet: worksheet.name.trim(),
          row: rowNumber,
          cell: activityCell.address,
          statusCell: statusCell.address,
          sourceMember: sourceMember ?? null,
          sourceCode: subGoal.sourceCode,
          keyCode: subGoal.keyCode,
          subGoalTitle: subGoal.title,
          activity,
          workDate: dateColumn.date,
          rawStatus,
          status: normalizeStatus(rawStatus ?? ""),
        });
      }
    }
  }
  return records;
}

function containsAlias(value: string, alias: string): boolean {
  const haystack = ` ${searchable(value)} `;
  const needle = ` ${searchable(alias)} `;
  return haystack.includes(needle);
}

function projectEvidence(project: ExistingProject): string {
  return [project.master_job_no, project.name, project.client_name, project.code]
    .filter((value): value is string => Boolean(value))
    .join(" / ");
}

function projectLabel(project: ExistingProject): string {
  return `${project.master_job_no ?? project.name} (${project.id})`;
}

export function resolveProject(
  activity: string,
  projects: ExistingProject[],
): Match<ExistingProject> {
  // CAC Projects is the project master. A project without a CAC master job
  // number may have been created manually or by another integration and must
  // never become a STOP match merely because its display name is similar.
  const activeProjects = projects.filter(
    (project) => project.is_active && Boolean(project.master_job_no),
  );
  const normalizedActivity = normalizeHistorical(activity);
  const exactMaster = activeProjects.filter((project) => {
    const master = normalizeHistorical(project.master_job_no ?? "");
    return Boolean(master) && (normalizedActivity === master || normalizedActivity.includes(master));
  });
  if (exactMaster.length === 1) {
    return { record: exactMaster[0], strategy: "EXACT_CAC_JOB_NO", candidates: exactMaster, sourceLabel: exactMaster[0].master_job_no ?? exactMaster[0].name };
  }
  if (exactMaster.length > 1) {
    return { record: null, strategy: "AMBIGUOUS_CAC_JOB_NO", candidates: exactMaster, sourceLabel: exactMaster[0].master_job_no ?? activity };
  }

  const codeMatches = activeProjects.filter((project) => project.code && containsAlias(activity, project.code));
  if (codeMatches.length === 1) {
    return { record: codeMatches[0], strategy: "EXACT_PROJECT_ID", candidates: codeMatches, sourceLabel: codeMatches[0].code ?? activity };
  }
  if (codeMatches.length > 1) {
    return { record: null, strategy: "AMBIGUOUS_PROJECT_ID", candidates: codeMatches, sourceLabel: codeMatches[0].code ?? activity };
  }

  const exactNames = activeProjects.filter((project) => normalizeHistorical(project.name) === normalizedActivity);
  if (exactNames.length === 1) {
    return { record: exactNames[0], strategy: "EXACT_NORMALIZED_PROJECT_NAME", candidates: exactNames, sourceLabel: exactNames[0].name };
  }
  if (exactNames.length > 1) {
    return { record: null, strategy: "AMBIGUOUS_NORMALIZED_PROJECT_NAME", candidates: exactNames, sourceLabel: activity };
  }

  for (const alias of CONFIRMED_PROJECT_ALIASES) {
    const matchingAlias = alias.aliases.find((candidate) => containsAlias(activity, candidate));
    if (!matchingAlias) continue;
    const targets = activeProjects.filter((project) => containsAlias(projectEvidence(project), alias.targetEvidence));
    if (targets.length === 1) {
      return { record: targets[0], strategy: `CONFIRMED_PROJECT_ALIAS:${matchingAlias}`, candidates: targets, sourceLabel: matchingAlias };
    }
    return { record: null, strategy: "UNRESOLVED_CONFIRMED_ALIAS_TARGET", candidates: targets, sourceLabel: matchingAlias };
  }

  for (const family of AMBIGUOUS_PROJECT_FAMILIES) {
    const matchingAlias = family.aliases.find((candidate) => containsAlias(activity, candidate));
    if (!matchingAlias) continue;
    const candidates = activeProjects.filter((project) => family.aliases.some((alias) => containsAlias(projectEvidence(project), alias)));
    return { record: null, strategy: `AMBIGUOUS_PROJECT_FAMILY:${family.label}`, candidates, sourceLabel: family.label };
  }

  const prefix = compact(activity.split(/\s+-\s+|\s*:\s*/)[0] ?? activity);
  return { record: null, strategy: "NO_PROJECT_MATCH", candidates: [], sourceLabel: prefix || activity };
}

function memberTaskCategory(team: string | null): string | null {
  const normalized = normalizeHistorical(team ?? "");
  if (normalized === "AI TEAM") return "AI Work";
  if (normalized === "CGI") return "CGI";
  if (normalized === "EDITING") return "Editing";
  if (normalized === "POST - PRODUCTION" || normalized === "POST PRODUCTION") return "Post Work";
  return null;
}

function taskKey(category: string, title: string): string {
  return `${normalizeHistorical(category)}\u0000${normalizeHistorical(title)}`;
}

export function resolveTask(
  activity: string,
  memberTeam: string | null,
  tasks: ExistingTask[],
): Match<ExistingTask> {
  const activeTasks = tasks.filter((task) => task.is_active);
  const category = memberTaskCategory(memberTeam);
  const desired = new Map<string, { category: string; title: string; strategy: string }>();
  const add = (taskCategory: string, title: string, strategy: string) => {
    desired.set(taskKey(taskCategory, title), { category: taskCategory, title, strategy });
  };
  const has = (pattern: RegExp) => pattern.test(searchable(activity));

  if (category === "AI Work") {
    if (has(/\b(IMAGE GENERATE|IMAGE GENERATION|AI IMAGE)\b/)) add(category, "Image Generate", "AI_IMAGE_ALIAS");
    if (has(/\b(MOTION GENERATE|MOTION GENERATION|AI MOTION|VIDEO GENERATE|VIDEO GENERATION)\b/)) add(category, "Motion Generate", "AI_MOTION_ALIAS");
    if (has(/\bREFERENCE\b/)) add(category, "Reference", "AI_REFERENCE_KEYWORD");
    if (has(/\bREWORK\b/)) add(category, "Rework", "TEAM_SCOPED_REWORK");
    if (has(/\b(SONG GENERATE|SONG GENERATION|MUSIC GENERATE|MUSIC GENERATION)\b/)) add(category, "Song Generate", "AI_SONG_ALIAS");
  }
  if (category === "CGI") {
    if (has(/\bANIMATION\b/)) add(category, "Animation", "CGI_ANIMATION_KEYWORD");
    if (has(/\bCAD( CONVERSION)?\b/)) add(category, "CAD Conversion", "CGI_CAD_KEYWORD");
    if (has(/\bLIGHTING\b/)) add(category, "Lighting", "CGI_LIGHTING_KEYWORD");
    if (has(/\bMODELL?ING\b|\bMODEL\b/)) add(category, "Modeling", "CGI_MODELING_ALIAS");
    if (has(/\bRENDER(ING)?\b/)) add(category, "Render", "CGI_RENDER_ALIAS");
    if (has(/\bREWORK\b/)) add(category, "Rework", "TEAM_SCOPED_REWORK");
    if (has(/\bTEXTUR(E|ING)\b/)) add(category, "Texturing", "CGI_TEXTURING_ALIAS");
  }
  if (category === "Editing") {
    if (has(/\b(COLOR|COLOUR) GRAD(E|ING)\b/)) add(category, "Color Grading", "EDITING_COLOR_GRADING_ALIAS");
    if (has(/\bFINAL CUT\b/)) add(category, "Final Cut", "EDITING_FINAL_CUT_KEYWORD");
    if (has(/\bMUSIC REFERENCE\b/)) add(category, "Music Reference", "EDITING_MUSIC_REFERENCE_KEYWORD");
    if (has(/\bREWORK\b/)) add(category, "Rework", "TEAM_SCOPED_REWORK");
    if (has(/\bROUGH CUT\b/)) add(category, "Rough Cut", "EDITING_ROUGH_CUT_KEYWORD");
    if (has(/\b(TIMELINE|TRACING)\b/)) add(category, "Timeline/Tracing", "EDITING_TIMELINE_TRACING_KEYWORD");
  }
  if (category === "Post Work") {
    if (has(/\b(COLOR|COLOUR) CORRECTION\b/)) add(category, "Color Correction", "POST_COLOR_CORRECTION_ALIAS");
    if (has(/\b(COMPOSITION|COMPOSITING)\b/)) add(category, "Composition", "POST_COMPOSITION_ALIAS");
    if (has(/\bRETOUCH(ING)?\b/)) add(category, "Retouch", "POST_RETOUCH_ALIAS");
    if (has(/\bREWORK\b/)) add(category, "Rework", "TEAM_SCOPED_REWORK");
  }
  if (has(/\bCLIENT COORDINATION\b/)) add("Overlook", "Client Coordination", "OVERLOOK_CLIENT_COORDINATION_KEYWORD");
  if (has(/\b(QUALITY CONTROL|QC)\b/)) add("Overlook", "QC", "OVERLOOK_QC_KEYWORD");
  if (has(/\bTEAM COORDINATION\b/)) add("Overlook", "Team Coordination", "OVERLOOK_TEAM_COORDINATION_KEYWORD");

  const matches = activeTasks.filter((task) => desired.has(taskKey(task.category, task.title)));
  if (matches.length === 1) {
    const rule = desired.get(taskKey(matches[0].category, matches[0].title));
    return { record: matches[0], strategy: rule?.strategy ?? "CANONICAL_TASK", candidates: matches, sourceLabel: activity };
  }
  return {
    record: null,
    strategy: matches.length > 1 ? "MULTIPLE_CANONICAL_TASK_SIGNALS" : "NO_CANONICAL_TASK_SIGNAL",
    candidates: matches,
    sourceLabel: activity,
  };
}

function resolveMember(
  sourceName: string | null,
  teamMembers: TeamAlignmentMember[],
  databaseMembers: ExistingMember[],
): Match<ExistingMember> & { team: string | null } {
  if (!sourceName) {
    return { record: null, strategy: "NO_SOURCE_MEMBER_HEADER", candidates: [], sourceLabel: "(unidentified member)", team: null };
  }
  const teamResolution = resolveTeamAlignmentName(sourceName, teamMembers);
  if (!teamResolution.canonicalName) {
    return { record: null, strategy: teamResolution.strategy, candidates: [], sourceLabel: compact(sourceName), team: null };
  }
  const canonicalName = teamResolution.canonicalName;
  const sourceMaster = teamMembers.find((member) => normalizeHistorical(member.name) === normalizeHistorical(canonicalName));
  const matches = databaseMembers.filter(
    (member) => member.is_active && normalizeHistorical(member.name) === normalizeHistorical(canonicalName),
  );
  return {
    record: matches.length === 1 ? matches[0] : null,
    strategy: matches.length === 1 ? teamResolution.strategy : matches.length > 1 ? "AMBIGUOUS_ACTIVE_DATABASE_MEMBER" : "TEAM_MEMBER_MISSING_FROM_DATABASE",
    candidates: matches,
    sourceLabel: compact(sourceName),
    team: sourceMaster?.team ?? null,
  };
}

function resolveSubGoal(
  source: HistoricalWorkSource,
  snapshot: DatabaseSnapshot,
): ExistingSubGoal | null {
  const key = snapshot.keys.find((candidate) => candidate.code === source.keyCode);
  if (!key || !source.subGoalTitle) return null;
  const matches = snapshot.subGoals.filter(
    (subGoal) => subGoal.is_active
      && subGoal.key_id === key.id
      && normalizeHistorical(subGoal.title) === normalizeHistorical(source.subGoalTitle),
  );
  return matches.length === 1 ? matches[0] : null;
}

function countedLabels(values: Array<{ label: string; reason?: string }>): CountedLabel[] {
  const groups = new Map<string, { label: string; count: number; reasons: Set<string> }>();
  for (const value of values) {
    const identity = normalizeHistorical(value.label || "(blank)");
    const group = groups.get(identity) ?? { label: value.label || "(blank)", count: 0, reasons: new Set<string>() };
    group.count += 1;
    if (value.reason) group.reasons.add(value.reason);
    groups.set(identity, group);
  }
  return [...groups.values()]
    .map((group) => ({ label: group.label, count: group.count, reasons: [...group.reasons].sort() }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function buildHistoricalAssignmentReport(
  sources: HistoricalWorkSource[],
  teamMembers: TeamAlignmentMember[],
  snapshot: DatabaseSnapshot,
): HistoricalAssignmentReport {
  const rows = sources.map((source): HistoricalAssignmentResolution => {
    const key = snapshot.keys.find((candidate) => candidate.code === source.keyCode) ?? null;
    const subGoal = resolveSubGoal(source, snapshot);
    const memberMatch = resolveMember(source.sourceMember, teamMembers, snapshot.members);
    const projectMatch = resolveProject(source.activity, snapshot.projects);
    const taskMatch = resolveTask(source.activity, memberMatch.team, snapshot.tasks);
    const problems: ProblemReason[] = [];
    if (!projectMatch.record) {
      problems.push(projectMatch.strategy.startsWith("AMBIGUOUS") ? "ambiguous_project" : "unmatched_project");
    }
    if (!memberMatch.record) problems.push("unmatched_member");
    if (!taskMatch.record) problems.push("unmatched_task");
    if (!key || !subGoal) problems.push("unmatched_sub_goal");
    if (!source.workDate) problems.push("missing_invalid_date");
    return {
      source,
      key,
      subGoal,
      project: projectMatch.record,
      projectStrategy: projectMatch.strategy,
      task: taskMatch.record,
      taskStrategy: taskMatch.strategy,
      member: memberMatch.record,
      memberStrategy: memberMatch.strategy,
      memberTeam: memberMatch.team,
      startDate: source.workDate,
      endDate: source.workDate,
      status: source.status,
      problems,
      projectCandidates: projectMatch.candidates.map(projectLabel),
    };
  });

  const unresolvedProjectRows = rows.filter((row) => row.problems.includes("unmatched_project") || row.problems.includes("ambiguous_project"));
  const unresolvedMemberRows = rows.filter((row) => row.problems.includes("unmatched_member"));
  const unmatchedTaskRows = rows.filter((row) => row.problems.includes("unmatched_task"));
  const unmatchedSubGoalRows = rows.filter((row) => row.problems.includes("unmatched_sub_goal"));
  return {
    rows,
    summary: {
      totalSourceWorkRows: rows.length,
      fullyMatchedRows: rows.filter((row) => row.problems.length === 0).length,
      unmatchedProject: rows.filter((row) => row.problems.includes("unmatched_project")).length,
      ambiguousProject: rows.filter((row) => row.problems.includes("ambiguous_project")).length,
      unmatchedMember: unresolvedMemberRows.length,
      unmatchedTask: unmatchedTaskRows.length,
      unmatchedSubGoal: unmatchedSubGoalRows.length,
      missingInvalidDate: rows.filter((row) => row.problems.includes("missing_invalid_date")).length,
      rowsWithMultipleProblems: rows.filter((row) => row.problems.length > 1).length,
    },
    unresolvedProjects: countedLabels(unresolvedProjectRows.map((row) => ({
      label: resolveProject(row.source.activity, snapshot.projects).sourceLabel,
      reason: row.problems.includes("ambiguous_project") ? "ambiguous_project" : "unmatched_project",
    }))),
    unresolvedMembers: countedLabels(unresolvedMemberRows.map((row) => ({
      label: row.source.sourceMember ?? "(unidentified member)",
    }))),
    unmatchedTasks: countedLabels(unmatchedTaskRows.map((row) => ({ label: row.source.activity }))),
    unmatchedSubGoals: countedLabels(unmatchedSubGoalRows.map((row) => ({
      label: `${row.source.keyCode} -> ${row.source.subGoalTitle || `(blank ${row.source.sourceCode})`}`,
    }))),
  };
}

async function readDatabaseSnapshot(client: PoolClient): Promise<DatabaseSnapshot> {
  const keys = await client.query<ExistingKey>("SELECT id, code, title FROM assignment_keys ORDER BY code");
  const subGoals = await client.query<ExistingSubGoal>(`
    SELECT sg.id, sg.key_id, ak.code AS key_code, sg.title, sg.is_active
      FROM assignment_sub_goals sg
      JOIN assignment_keys ak ON ak.id = sg.key_id
     WHERE sg.is_active
     ORDER BY ak.code, sg.title
  `);
  const projects = await client.query<ExistingProject>(`
    SELECT id, name, code, master_job_no, client_name, is_active
      FROM projects
     WHERE is_active
       AND master_job_no IS NOT NULL
     ORDER BY name, id
  `);
  const tasks = await client.query<ExistingTask>(`
    SELECT id, category, title, is_active
      FROM task_master
     WHERE is_active
     ORDER BY category, title
  `);
  const members = await client.query<ExistingMember>(`
    SELECT id, name, team, is_active
      FROM members
     WHERE is_active
     ORDER BY name, id
  `);
  return { keys: keys.rows, subGoals: subGoals.rows, projects: projects.rows, tasks: tasks.rows, members: members.rows };
}

function assertCompletedMasterData(snapshot: DatabaseSnapshot): void {
  const keyCodes = snapshot.keys.map((key) => key.code).sort();
  if (JSON.stringify(keyCodes) !== JSON.stringify([...EXPECTED_KEYS])) {
    throw new Error(`Expected KEY_A, KEY_B, and KEY_C; found ${keyCodes.join(", ") || "none"}.`);
  }
  if (snapshot.subGoals.length !== 180) throw new Error(`Expected 180 active canonical Sub Goals; found ${snapshot.subGoals.length}.`);
  if (snapshot.tasks.length !== 25) throw new Error(`Expected 25 active canonical Task Master records; found ${snapshot.tasks.length}.`);
  if (!snapshot.projects.length) {
    throw new Error("No active CAC Projects master records were found. Run the CAC master sync before importing STOP assignments.");
  }
}

function printCountedSection(title: string, records: CountedLabel[]): void {
  console.log("");
  console.log(`=== ${title} ===`);
  if (!records.length) console.log("  (none)");
  records.forEach((record) => {
    const reasons = record.reasons?.length ? ` [${record.reasons.join(", ")}]` : "";
    console.log(`  ${record.count} x ${record.label}${reasons}`);
  });
}

function printReport(report: HistoricalAssignmentReport): void {
  console.log("============================================================");
  console.log("STOP HISTORICAL ASSIGNMENT MAPPER — DRY RUN");
  console.log("READ ONLY: no projects, members, sub goals, tasks, teams, or key_assignments are created or changed.");
  console.log("============================================================");
  console.log("");
  console.log("=== SOURCE ROW RESOLUTIONS ===");
  report.rows.forEach((row) => {
    const outcome = row.problems.length ? `UNRESOLVED:${row.problems.join(",")}` : "FULLY_MAPPABLE";
    console.log(`[${row.source.file} :: ${row.source.sheet}!${row.source.row} ${row.source.cell}] ${outcome}`);
    console.log(`  Source member: ${row.source.sourceMember ?? "(unidentified)"}`);
    console.log(`  Key/Sub Goal: ${row.source.keyCode} -> ${row.source.subGoalTitle || `(blank ${row.source.sourceCode})`}`);
    console.log(`  Activity: ${row.source.activity}`);
    console.log(`  Project: ${row.project ? projectLabel(row.project) : `(unresolved via ${row.projectStrategy})`}`);
    if (row.projectCandidates.length) console.log(`  Project candidates: ${row.projectCandidates.join("; ")}`);
    console.log(`  Task: ${row.task ? `${row.task.category} -> ${row.task.title} (${row.task.id})` : `(unmatched via ${row.taskStrategy})`}`);
    console.log(`  Member: ${row.member ? `${row.member.name} (${row.member.id}; team ${row.memberTeam ?? "blank"})` : `(unmatched via ${row.memberStrategy})`}`);
    console.log(`  Date: ${row.startDate ?? "(missing/invalid)"} to ${row.endDate ?? "(missing/invalid)"}`);
    console.log(`  Status: ${row.status ?? `(not available; source ${row.source.rawStatus ?? "blank"})`}`);
  });

  console.log("");
  console.log("=== SUMMARY ===");
  console.log(`Total STOP work rows examined: ${report.summary.totalSourceWorkRows}`);
  console.log(`Fully matched rows: ${report.summary.fullyMatchedRows}`);
  console.log(`Unmatched project: ${report.summary.unmatchedProject}`);
  console.log(`Ambiguous project: ${report.summary.ambiguousProject}`);
  console.log(`Unmatched member: ${report.summary.unmatchedMember}`);
  console.log(`Unmatched task: ${report.summary.unmatchedTask}`);
  console.log(`Unmatched Sub Goal: ${report.summary.unmatchedSubGoal}`);
  console.log(`Missing/invalid date: ${report.summary.missingInvalidDate}`);
  console.log(`Rows with multiple problems: ${report.summary.rowsWithMultipleProblems}`);
  printCountedSection("UNRESOLVED PROJECT NAMES", report.unresolvedProjects);
  printCountedSection("UNRESOLVED MEMBER NAMES", report.unresolvedMembers);
  printCountedSection("UNMATCHED TASK / ACTIVITY NAMES", report.unmatchedTasks);
  printCountedSection("UNMATCHED SUB GOALS", report.unmatchedSubGoals);
  console.log("");
  console.log("Dry-run complete. The database transaction was read only and was rolled back. No inserts or updates were attempted.");
}

type FullyMatchedResolution = HistoricalAssignmentResolution & {
  key: ExistingKey;
  subGoal: ExistingSubGoal;
  project: ExistingProject;
  task: ExistingTask;
  member: ExistingMember;
  startDate: string;
  endDate: string;
};

function isFullyMatched(row: HistoricalAssignmentResolution): row is FullyMatchedResolution {
  return row.problems.length === 0
    && Boolean(row.key)
    && Boolean(row.subGoal)
    && Boolean(row.project)
    && Boolean(row.task)
    && Boolean(row.member)
    && Boolean(row.startDate)
    && Boolean(row.endDate);
}

// The STOP source cell (sheet + row + date) plus its resolved member/project/
// task is the natural key for "has this STOP entry already been imported?".
// It is enforced by the partial unique index ux_key_assignments_import_source
// (see 024_key_assignment_import_provenance.sql), so ON CONFLICT DO NOTHING
// makes reruns idempotent even across separate process invocations, not just
// within a single run's in-memory state.
const IMPORT_SOURCE_CONFLICT_TARGET = `(source_sheet, source_row, start_date, member_id, project_id, task_id)
       WHERE source_sheet IN ('Management', 'Operation') AND source_row IS NOT NULL`;

interface ImportFailure {
  row: FullyMatchedResolution;
  error: string;
}

interface ImportOutcome {
  inserted: number;
  skipped: number;
  unresolved: number;
  failed: number;
  failures: ImportFailure[];
}

async function insertKeyAssignment(
  client: PoolClient,
  row: FullyMatchedResolution,
): Promise<"inserted" | "skipped"> {
  const result = await client.query(
    `INSERT INTO key_assignments (
       key_id, sub_goal_id, project_id, task_id, member_id,
       start_date, end_date, status,
       source_sheet, source_row, source_cell, source_activity
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT ${IMPORT_SOURCE_CONFLICT_TARGET}
     DO NOTHING
     RETURNING id`,
    [
      row.key.id,
      row.subGoal.id,
      row.project.id,
      row.task.id,
      row.member.id,
      row.startDate,
      row.endDate,
      row.status ?? "NOT_STARTED",
      row.source.sheet,
      row.source.row,
      row.source.cell,
      row.source.activity,
    ],
  );
  return result.rowCount ? "inserted" : "skipped";
}

// Only rows with zero unresolved problems (same "fully matched" definition the
// dry-run report already uses) are attempted. Unresolved rows are skipped,
// not backfilled — this function never writes to projects, task_master,
// members, or assignment_sub_goals. Each attempted row runs under its own
// savepoint so one failure (e.g. a record deactivated between the snapshot
// read and the insert) cannot abort the rows around it.
async function importFullyMatchedRows(
  client: PoolClient,
  report: HistoricalAssignmentReport,
): Promise<ImportOutcome> {
  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  const failures: ImportFailure[] = [];

  for (const row of report.rows) {
    if (!isFullyMatched(row)) continue;
    await client.query("SAVEPOINT stop_import_row");
    try {
      const outcome = await insertKeyAssignment(client, row);
      if (outcome === "inserted") inserted += 1;
      else skipped += 1;
      await client.query("RELEASE SAVEPOINT stop_import_row");
    } catch (error) {
      await client.query("ROLLBACK TO SAVEPOINT stop_import_row");
      failed += 1;
      failures.push({ row, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    inserted,
    skipped,
    unresolved: report.rows.length - report.summary.fullyMatchedRows,
    failed,
    failures,
  };
}

function printImportResult(report: HistoricalAssignmentReport, outcome: ImportOutcome): void {
  console.log("============================================================");
  console.log("STOP HISTORICAL ASSIGNMENT MAPPER — IMPORT");
  console.log("Project master: existing active CAC Projects records only.");
  console.log("Only fully matched rows were inserted into key_assignments. No project, task, member, or sub goal was created.");
  console.log("Idempotent: rerunning skips any STOP source cell already imported.");
  console.log("============================================================");
  console.log("");
  console.log("=== IMPORT RESULT ===");
  console.log(`Total STOP work rows examined: ${report.summary.totalSourceWorkRows}`);
  console.log(`Inserted: ${outcome.inserted}`);
  console.log(`Skipped (already imported): ${outcome.skipped}`);
  console.log(`Unresolved (not fully matched, not attempted): ${outcome.unresolved}`);
  console.log(`Failed (attempted, error on insert): ${outcome.failed}`);
  if (outcome.failures.length) {
    console.log("");
    console.log("=== FAILED ROWS ===");
    outcome.failures.forEach(({ row, error }) => {
      console.log(`[${row.source.file} :: ${row.source.sheet}!${row.source.row} ${row.source.cell}] ${row.source.activity} — ${error}`);
    });
  }
  console.log("");
  console.log("=== UNRESOLVED BREAKDOWN (unchanged from dry run) ===");
  console.log(`Unmatched project: ${report.summary.unmatchedProject}`);
  console.log(`Ambiguous project: ${report.summary.ambiguousProject}`);
  console.log(`Unmatched member: ${report.summary.unmatchedMember}`);
  console.log(`Unmatched task: ${report.summary.unmatchedTask}`);
  console.log(`Unmatched Sub Goal: ${report.summary.unmatchedSubGoal}`);
  console.log(`Missing/invalid date: ${report.summary.missingInvalidDate}`);
  printCountedSection("UNRESOLVED PROJECT NAMES", report.unresolvedProjects);
  printCountedSection("UNRESOLVED MEMBER NAMES", report.unresolvedMembers);
  printCountedSection("UNMATCHED TASK / ACTIVITY NAMES", report.unmatchedTasks);
  printCountedSection("UNMATCHED SUB GOALS", report.unmatchedSubGoals);
  console.log("");
  console.log("Import complete. Transaction committed.");
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const importMode = args.includes("--import");
  const unknownArguments = args.filter((arg) => arg !== "--import");
  if (unknownArguments.length) throw new Error(`Unknown argument(s): ${unknownArguments.join(", ")}`);
  loadLocalEnvironment();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  const importsDirectory = path.join(process.cwd(), "imports");
  const teamMembers = await readTeamAlignment(path.join(importsDirectory, TEAM_ALIGNMENT_FILE));
  const sources = await readHistoricalWorkRows(path.join(importsDirectory, STOP_FILE), teamMembers);
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
    max: 1,
    application_name: importMode ? "stop-historical-assignment-import" : "stop-historical-assignment-dry-run",
  });
  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query(importMode ? "BEGIN" : "BEGIN TRANSACTION READ ONLY");
    transactionOpen = true;
    const snapshot = await readDatabaseSnapshot(client);
    assertCompletedMasterData(snapshot);
    const report = buildHistoricalAssignmentReport(sources, teamMembers, snapshot);

    if (importMode) {
      const outcome = await importFullyMatchedRows(client, report);
      await client.query("COMMIT");
      transactionOpen = false;
      printImportResult(report, outcome);
    } else {
      printReport(report);
      await client.query("ROLLBACK");
      transactionOpen = false;
    }
  } finally {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error("Historical assignment dry run failed:", error);
    process.exitCode = 1;
  });
}
