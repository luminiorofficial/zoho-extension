import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import type { PoolClient } from "pg";
import { fileURLToPath } from "url";
import { db } from "../src/lib/db";
import {
  readTeamAlignment,
  resolveTeamAlignmentName,
  type TeamAlignmentMember,
} from "./map-stop-historical-assignments";

const ALLOWED_SHEETS = new Set(["Management", "Operation"]);
const TEAM_ALIGNMENT_FILE = "Team Alignment.xlsx";
const STATUS_HEADER_PATTERN = /^D\s*\/\s*NS\s*\/\s*P$|^STATUS$/i;

type DailyStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "DONE"
  | "ON_HOLD"
  | "ABSENT"
  | "LEAVE";

type EntryType = "WORK" | "LEAVE" | "ATTENDANCE" | "NOTE" | "HOLIDAY";

interface DailyColumnPair {
  activityColumn: number;
  statusColumn: number;
  updateDate: string;
}

interface DepartmentRecord {
  key: string;
  name: string;
  sourceRow: number;
  sourceCell: string;
}

export interface MemberRecord {
  key: string;
  departmentKey: string;
  name: string;
  sourceRow: number;
  sourceCell: string;
}

interface GoalRecord {
  key: string;
  departmentKey: string;
  memberKey: string;
  code: string | null;
  title: string;
  description: string | null;
  sourceRow: number;
  sourceCell: string;
}

interface TargetRecord {
  key: string;
  goalKey: string;
  title: string;
  targetText: string;
  sourceRow: number;
  sourceCell: string;
}

interface ActionRecord {
  key: string;
  goalKey: string;
  memberKey: string;
  code: string;
  title: string;
  description: string | null;
  sourceRow: number;
  sourceCell: string;
}

interface DailyUpdateRecord {
  departmentKey: string;
  memberKey: string | null;
  goalKey: string | null;
  targetKey: string | null;
  actionKey: string | null;
  updateDate: string;
  activity: string | null;
  status: DailyStatus | null;
  entryType: EntryType;
  note: string | null;
  sourceRow: number;
  sourceCell: string;
}

interface ParsedSheet {
  headerRow: number;
  dailyColumns: DailyColumnPair[];
  departments: DepartmentRecord[];
  members: MemberRecord[];
  goals: GoalRecord[];
  targets: TargetRecord[];
  actions: ActionRecord[];
  dailyUpdates: DailyUpdateRecord[];
}

interface ParsedActionCode {
  code: string;
  titleFromCodeCell: string;
  codeSource: "A" | "B";
}

function getCellText(cell: ExcelJS.Cell): string {
  const value = cell.value;

  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return String(value).trim();

  if ("richText" in value) {
    return value.richText.map((part) => part.text).join("").trim();
  }

  if ("text" in value) {
    if (typeof value.text === "string") return value.text.trim();
    const nestedText = value.text as unknown;
    if (nestedText && typeof nestedText === "object" && "richText" in nestedText) {
      const richText = nestedText.richText as { text: string }[];
      return richText.map((part) => part.text).join("").trim();
    }
  }

  if ("result" in value && value.result !== undefined && value.result !== null) {
    return String(value.result).trim();
  }

  return String(cell.text ?? "").trim();
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sourceCellReference(...cells: ExcelJS.Cell[]): string {
  const populated = cells.filter((cell) => getCellText(cell));
  if (populated.length === 0) return cells[0]?.address ?? "";
  if (populated.length === 1) return populated[0].address;
  return `${populated[0].address}:${populated[populated.length - 1].address}`;
}

function formatDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseHeaderDate(cell: ExcelJS.Cell): string | null {
  if (cell.value instanceof Date && !Number.isNaN(cell.value.getTime())) {
    return formatDate(cell.value);
  }

  const text = compactText(getCellText(cell));
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) return null;

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : formatDate(date);
}

function detectDailyColumns(worksheet: ExcelJS.Worksheet): {
  headerRow: number;
  dailyColumns: DailyColumnPair[];
} {
  let bestHeaderRow = 0;
  let bestDateCells: { column: number; updateDate: string }[] = [];
  let bestMarkerCount = 0;

  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const dateCells: { column: number; updateDate: string }[] = [];
    let markerCount = 0;

    row.eachCell({ includeEmpty: false }, (cell) => {
      const updateDate = parseHeaderDate(cell);
      if (!updateDate) return;

      const column = Number(cell.col);
      dateCells.push({ column, updateDate });
      if (STATUS_HEADER_PATTERN.test(compactText(getCellText(row.getCell(column + 1))))) {
        markerCount += 1;
      }
    });

    const hasRepeatedPattern =
      dateCells.length >= 2 && markerCount >= Math.max(2, Math.floor(dateCells.length * 0.8));

    if (
      hasRepeatedPattern &&
      (markerCount > bestMarkerCount ||
        (markerCount === bestMarkerCount && dateCells.length > bestDateCells.length))
    ) {
      bestHeaderRow = row.number;
      bestDateCells = dateCells;
      bestMarkerCount = markerCount;
    }
  });

  if (bestHeaderRow === 0) {
    throw new Error(`Could not find a repeated date/activity/status column pattern in ${worksheet.name}`);
  }

  return {
    headerRow: bestHeaderRow,
    dailyColumns: bestDateCells.map(({ column, updateDate }) => ({
      activityColumn: column,
      statusColumn: column + 1,
      updateDate,
    })),
  };
}

function normalizeActionCode(value: string): string {
  return value.toUpperCase().replace(/\s+/g, "").replace(/-+/g, "-");
}

function parseActionCode(columnA: string, columnB: string): ParsedActionCode | null {
  const leadingCode = columnA.match(
    /^\s*((?:[A-Z]\s*\d+\s*-\s*[A-Z])|(?:[A-Z]\s*\d+))\s*(?:(?:-|:)\s*(.*))?$/i,
  );

  if (leadingCode) {
    return {
      code: normalizeActionCode(leadingCode[1]),
      titleFromCodeCell: compactText(leadingCode[2] ?? ""),
      codeSource: "A",
    };
  }

  const uppercaseUnseparatedCode = columnA.match(
    /^\s*((?:[A-Z]\s*\d+\s*-\s*[A-Z])|(?:[A-Z]\s*\d+))\s+([A-Z]+(?:\s+[A-Z]+)+)\s*$/,
  );

  if (uppercaseUnseparatedCode) {
    return {
      code: normalizeActionCode(uppercaseUnseparatedCode[1]),
      titleFromCodeCell: compactText(uppercaseUnseparatedCode[2]),
      codeSource: "A",
    };
  }

  const trailingCode = columnB.match(
    /(?:^|\s|:)\b((?:[A-Z]\s*\d+\s*-\s*[A-Z])|(?:[A-Z]\s*\d+))\b(?:\s*\([^)]*\))?\s*$/i,
  );

  if (!trailingCode) return null;

  return {
    code: normalizeActionCode(trailingCode[1]),
    titleFromCodeCell: compactText(columnB.slice(0, trailingCode.index).replace(/[:\s-]+$/, "")),
    codeSource: "B",
  };
}

function parseGoalCode(value: string): string | null {
  const objectiveCode = value.match(/\b(?:KEY\s+)?(?:OBJECTIVE|TASK)\s+([A-Z0-9]+)/i);
  if (objectiveCode) return objectiveCode[1].toUpperCase();

  const shortCode = value.match(/^\s*([A-Z])\s*(\d+)\s*[.:]/i);
  if (shortCode) return `${shortCode[1].toUpperCase()}${shortCode[2]}`;

  return null;
}

function isManagementDepartment(columnA: string, columnB: string): boolean {
  if (/^MARKETING\s*\(MON\)$/i.test(columnA)) return true;
  if (/^\d+\.\s*SALES\s*\(TUES\)$/i.test(columnA)) return true;
  if (/OPERATIONS\s*\(WED\)$/i.test(columnA) && columnB.includes("/")) return true;
  return /^\d+\.\s*(?:ACCOUNTS?\s*&\s*INVESTMENT|R\s*&\s*D|ADMIN|MANAGEMENT)\b/i.test(
    columnA,
  );
}

function isOperationDepartment(columnA: string): boolean {
  return /^(?:POST\s*-\s*PRODUCTION|CGI|AI\s*&\s*RND|DOP\s*&\s*MOTION\s+EDITING)$/i.test(
    columnA,
  );
}

function isDepartmentRow(sheetName: string, columnA: string, columnB: string): boolean {
  return sheetName === "Management"
    ? isManagementDepartment(columnA, columnB)
    : isOperationDepartment(columnA);
}

function isLikelyPersonName(value: string): boolean {
  if (!/^[\p{L}]+(?:[ .'-]+[\p{L}]+){0,3}$/u.test(value)) return false;
  if (value.length > 60) return false;
  if (/^K\s*T\s*[ABC]$/i.test(value)) return false;

  return !/\b(?:PROVISION|ACCOUNTING|OPERATION|EXECUTION|EXCUTION|OBJECTIVE|TASK|PROJECT|PORTFOLIO|DEVELOPMENT|PRODUCTION|MANAGEMENT|MARKETING|SALES|ADMIN|FUTURE|CGI|RND|DOP)\b/i.test(
    value,
  );
}

function isGoalStyleRow(row: ExcelJS.Row, columnA: string, columnB: string): boolean {
  if (columnA) return row.getCell(1).font?.bold === true;
  return Boolean(columnB) && row.getCell(2).font?.bold === true;
}

function findNextContentRow(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
): { row: ExcelJS.Row; columnA: string; columnB: string } | null {
  for (let nextRowNumber = rowNumber + 1; nextRowNumber <= worksheet.rowCount; nextRowNumber += 1) {
    const row = worksheet.getRow(nextRowNumber);
    const columnA = compactText(getCellText(row.getCell(1)));
    const columnB = compactText(getCellText(row.getCell(2)));
    const columnC = compactText(getCellText(row.getCell(3)));

    if (columnA || columnB || columnC) return { row, columnA, columnB };
  }

  return null;
}

function isMemberRow(
  worksheet: ExcelJS.Worksheet,
  row: ExcelJS.Row,
  columnA: string,
): boolean {
  if (!columnA || row.getCell(1).font?.bold !== true || !isLikelyPersonName(columnA)) {
    return false;
  }

  const next = findNextContentRow(worksheet, row.number);
  if (!next) return false;

  return isGoalStyleRow(next.row, next.columnA, next.columnB);
}

function classifyDailyEntry(
  activityText: string,
  statusText: string,
): {
  activity: string | null;
  status: DailyStatus | null;
  entryType: EntryType;
  note: string | null;
} {
  const activity = activityText.trim();
  const rawStatus = statusText.trim();
  const combined = `${activity}\n${rawStatus}`.toUpperCase();

  if (/APPROVED LEAVE|HALF DAY/.test(combined)) {
    return {
      activity: activity || rawStatus || null,
      status: "LEAVE",
      entryType: "LEAVE",
      note: null,
    };
  }

  if (/ABSENT FOR (?:DAY|MEETING)/.test(combined)) {
    return {
      activity: activity || rawStatus || null,
      status: "ABSENT",
      entryType: "ATTENDANCE",
      note: null,
    };
  }

  if (/WORK ON HOLIDAY/.test(combined)) {
    return {
      activity: activity || rawStatus || null,
      status: null,
      entryType: "HOLIDAY",
      note: null,
    };
  }

  const normalizedStatus = rawStatus.toUpperCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const statusMap: Record<string, DailyStatus> = {
    DONE: "DONE",
    PROGRESS: "IN_PROGRESS",
    "IN PROGRESS": "IN_PROGRESS",
    "NOT STARTED": "NOT_STARTED",
    "ON HOLD": "ON_HOLD",
  };
  let status = statusMap[normalizedStatus] ?? null;
  const combinedStatuses = normalizedStatus
    .split(/\s*,\s*/)
    .map((value) => statusMap[value])
    .filter((value): value is DailyStatus => Boolean(value));

  if (
    !status &&
    combinedStatuses.length > 1 &&
    combinedStatuses.length === normalizedStatus.split(",").length
  ) {
    status = combinedStatuses.every((value) => value === combinedStatuses[0])
      ? combinedStatuses[0]
      : "IN_PROGRESS";
  }

  return {
    activity: activity || null,
    status,
    entryType: activity || status ? "WORK" : "NOTE",
    note: rawStatus && !status ? `Spreadsheet status: ${rawStatus}` : null,
  };
}

function combineTargetText(...values: string[]): string {
  return values.filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join("\n");
}

export function parseSheet(worksheet: ExcelJS.Worksheet): ParsedSheet {
  const { headerRow, dailyColumns } = detectDailyColumns(worksheet);
  const departments: DepartmentRecord[] = [];
  const members: MemberRecord[] = [];
  const goals: GoalRecord[] = [];
  const targets: TargetRecord[] = [];
  const actions: ActionRecord[] = [];
  const dailyUpdates: DailyUpdateRecord[] = [];

  let currentDepartment: DepartmentRecord | null = null;
  let currentMember: MemberRecord | null = null;
  let currentGoal: GoalRecord | null = null;
  let currentGoalTarget: TargetRecord | null = null;
  let currentTarget: TargetRecord | null = null;
  let currentAction: ActionRecord | null = null;

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    if (rowNumber === headerRow) continue;

    const row = worksheet.getRow(rowNumber);
    const columnA = compactText(getCellText(row.getCell(1)));
    const columnB = compactText(getCellText(row.getCell(2)));
    const columnC = compactText(getCellText(row.getCell(3)));
    const parsedAction = currentMember && currentGoal ? parseActionCode(columnA, columnB) : null;

    if (isDepartmentRow(worksheet.name.trim(), columnA, columnB)) {
      currentDepartment = {
        key: `department:${rowNumber}`,
        name: columnA.replace(/^\d+\.\s*/, ""),
        sourceRow: rowNumber,
        sourceCell: row.getCell(1).address,
      };
      departments.push(currentDepartment);
      currentMember = null;
      currentGoal = null;
      currentGoalTarget = null;
      currentTarget = null;
      currentAction = null;
    } else if (!currentDepartment) {
      continue;
    } else if (isMemberRow(worksheet, row, columnA)) {
      currentMember = {
        key: `member:${rowNumber}`,
        departmentKey: currentDepartment.key,
        name: columnA,
        sourceRow: rowNumber,
        sourceCell: row.getCell(1).address,
      };
      members.push(currentMember);
      currentGoal = null;
      currentGoalTarget = null;
      currentTarget = null;
      currentAction = null;
    } else if (currentMember && currentGoal && parsedAction) {
      const actionTitle =
        parsedAction.titleFromCodeCell ||
        (parsedAction.codeSource === "A" ? columnB : "") ||
        parsedAction.code;

      currentAction = {
        key: `action:${rowNumber}`,
        goalKey: currentGoal.key,
        memberKey: currentMember.key,
        code: parsedAction.code,
        title: actionTitle,
        description:
          parsedAction.codeSource === "A" && columnB && columnB !== actionTitle ? columnB : null,
        sourceRow: rowNumber,
        sourceCell: sourceCellReference(
          ...(parsedAction.codeSource === "A"
            ? [row.getCell(1), row.getCell(2)]
            : [row.getCell(2)]),
        ),
      };
      actions.push(currentAction);
      currentTarget = currentGoalTarget;

      if (columnC) {
        currentTarget = {
          key: `target:${rowNumber}:action`,
          goalKey: currentGoal.key,
          title: columnC,
          targetText: columnC,
          sourceRow: rowNumber,
          sourceCell: row.getCell(3).address,
        };
        targets.push(currentTarget);
      }
    } else if (currentMember && isGoalStyleRow(row, columnA, columnB)) {
      const goalTitle = columnA || columnB;
      currentGoal = {
        key: `goal:${rowNumber}`,
        departmentKey: currentDepartment.key,
        memberKey: currentMember.key,
        code: parseGoalCode(goalTitle),
        title: goalTitle,
        description: columnB && columnB !== goalTitle ? columnB : null,
        sourceRow: rowNumber,
        sourceCell: sourceCellReference(row.getCell(1), row.getCell(2)),
      };
      goals.push(currentGoal);
      currentAction = null;

      const targetText = combineTargetText(columnB, columnC);
      currentGoalTarget = targetText
        ? {
            key: `target:${rowNumber}:goal`,
            goalKey: currentGoal.key,
            title: columnC || columnB,
            targetText,
            sourceRow: rowNumber,
            sourceCell: sourceCellReference(row.getCell(2), row.getCell(3)),
          }
        : null;
      currentTarget = currentGoalTarget;

      if (currentTarget) targets.push(currentTarget);
    }

    for (const dailyColumn of dailyColumns) {
      const activityCell = row.getCell(dailyColumn.activityColumn);
      const statusCell = row.getCell(dailyColumn.statusColumn);
      const activityText = getCellText(activityCell);
      const statusText = getCellText(statusCell);

      if (!activityText && !statusText) continue;

      const classified = classifyDailyEntry(activityText, statusText);
      dailyUpdates.push({
        departmentKey: currentDepartment.key,
        memberKey: currentMember?.key ?? null,
        goalKey: currentGoal?.key ?? null,
        targetKey: currentTarget?.key ?? null,
        actionKey: currentAction?.key ?? null,
        updateDate: dailyColumn.updateDate,
        activity: classified.activity,
        status: classified.status,
        entryType: classified.entryType,
        note: classified.note,
        sourceRow: rowNumber,
        sourceCell: sourceCellReference(activityCell, statusCell),
      });
    }
  }

  return {
    headerRow,
    dailyColumns,
    departments,
    members,
    goals,
    targets,
    actions,
    dailyUpdates,
  };
}

async function getOrInsertDepartment(
  client: PoolClient,
  record: DepartmentRecord,
  sheet: string,
): Promise<string> {
  const existing = await client.query(
    `SELECT id
       FROM departments
      WHERE source_sheet = $1
        AND (source_row = $2 OR name = $3)
      ORDER BY (source_row = $2) DESC, created_at
      LIMIT 1`,
    [sheet, record.sourceRow, record.name],
  );
  if (existing.rows[0]) {
    await client.query(
      `UPDATE departments
          SET name = $2, source_sheet = $3, source_row = $4, source_cell = $5
        WHERE id = $1`,
      [existing.rows[0].id, record.name, sheet, record.sourceRow, record.sourceCell],
    );
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO departments (name, is_active, source_sheet, source_row, source_cell)
     VALUES ($1, true, $2, $3, $4)
     RETURNING id`,
    [record.name, sheet, record.sourceRow, record.sourceCell],
  );
  return inserted.rows[0].id;
}

export async function getExistingMember(
  client: PoolClient,
  record: MemberRecord,
  sheet: string,
  teamMembers: TeamAlignmentMember[],
): Promise<string> {
  const resolution = resolveTeamAlignmentName(record.name, teamMembers);
  if (!resolution.canonicalName) {
    throw new Error(
      `STOP member ${JSON.stringify(record.name)} at ${sheet} row ${record.sourceRow} ` +
        `does not resolve to a unique Team Alignment member (${resolution.strategy})`,
    );
  }

  const existing = await client.query<{ id: string }>(
    `SELECT id
       FROM members
      WHERE is_active = TRUE
        AND UPPER(REGEXP_REPLACE(BTRIM(name), '[[:space:]]+', ' ', 'g')) =
            UPPER(REGEXP_REPLACE(BTRIM($1), '[[:space:]]+', ' ', 'g'))
      ORDER BY created_at`,
    [resolution.canonicalName],
  );
  if (existing.rows.length !== 1) {
    throw new Error(
      `Team Alignment member ${JSON.stringify(resolution.canonicalName)} resolved from ` +
        `STOP ${JSON.stringify(record.name)} at ${sheet} row ${record.sourceRow} ` +
        `has ${existing.rows.length} active database matches; no member was created`,
    );
  }

  // Team Alignment owns member identity and provenance. STOP may only use the
  // already-synchronised member ID; it must never insert or mutate a member.
  return existing.rows[0].id;
}

async function getOrInsertGoal(
  client: PoolClient,
  record: GoalRecord,
  departmentId: string,
  memberId: string,
  sheet: string,
): Promise<string> {
  const existing = await client.query(
    `SELECT id
       FROM goals
      WHERE department_id = $1
        AND source_sheet = $2
        AND (
          source_row = $3
          OR (owner_member_id = $4 AND title = $5)
        )
      ORDER BY (source_row = $3) DESC, created_at
      LIMIT 1`,
    [departmentId, sheet, record.sourceRow, memberId, record.title],
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE goals
          SET owner_member_id = $2,
              code = $3,
              title = $4,
              description = $5,
              source_sheet = $6,
              source_row = $7,
              source_cell = $8,
              updated_at = NOW()
        WHERE id = $1`,
      [
        existing.rows[0].id,
        memberId,
        record.code,
        record.title,
        record.description,
        sheet,
        record.sourceRow,
        record.sourceCell,
      ],
    );
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO goals (
       department_id, owner_member_id, code, title, description,
       status, progress_percent, source_sheet, source_row, source_cell
     ) VALUES ($1, $2, $3, $4, $5, 'NOT_STARTED', 0, $6, $7, $8)
     RETURNING id`,
    [
      departmentId,
      memberId,
      record.code,
      record.title,
      record.description,
      sheet,
      record.sourceRow,
      record.sourceCell,
    ],
  );
  return inserted.rows[0].id;
}

async function getOrInsertTarget(
  client: PoolClient,
  record: TargetRecord,
  goalId: string,
  sheet: string,
): Promise<string> {
  const existing = await client.query(
    `SELECT id
       FROM targets
      WHERE goal_id = $1
        AND source_sheet = $2
        AND (source_row = $3 OR title = $4)
      ORDER BY (source_row = $3) DESC, created_at
      LIMIT 1`,
    [goalId, sheet, record.sourceRow, record.title],
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE targets
          SET title = $2,
              target_text = $3,
              source_sheet = $4,
              source_row = $5,
              source_cell = $6,
              updated_at = NOW()
        WHERE id = $1`,
      [
        existing.rows[0].id,
        record.title,
        record.targetText,
        sheet,
        record.sourceRow,
        record.sourceCell,
      ],
    );
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO targets (goal_id, title, target_text, source_sheet, source_row, source_cell)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [goalId, record.title, record.targetText, sheet, record.sourceRow, record.sourceCell],
  );
  return inserted.rows[0].id;
}

async function getOrInsertAction(
  client: PoolClient,
  record: ActionRecord,
  goalId: string,
  sheet: string,
): Promise<string> {
  const existing = await client.query(
    `SELECT id
       FROM actions
      WHERE goal_id = $1
        AND source_sheet = $2
        AND (source_row = $3 OR (code = $4 AND title = $5))
      ORDER BY (source_row = $3) DESC, created_at
      LIMIT 1`,
    [goalId, sheet, record.sourceRow, record.code, record.title],
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE actions
          SET code = $2,
              title = $3,
              description = $4,
              source_sheet = $5,
              source_row = $6,
              source_cell = $7,
              updated_at = NOW()
        WHERE id = $1`,
      [
        existing.rows[0].id,
        record.code,
        record.title,
        record.description,
        sheet,
        record.sourceRow,
        record.sourceCell,
      ],
    );
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    `INSERT INTO actions (
       goal_id, code, title, description, status, progress_percent,
       source_sheet, source_row, source_cell
     ) VALUES ($1, $2, $3, $4, 'NOT_STARTED', 0, $5, $6, $7)
     RETURNING id`,
    [
      goalId,
      record.code,
      record.title,
      record.description,
      sheet,
      record.sourceRow,
      record.sourceCell,
    ],
  );
  return inserted.rows[0].id;
}

interface ResolvedDailyUpdate {
  record: DailyUpdateRecord;
  departmentId: string;
  memberId: string | null;
  goalId: string | null;
  targetId: string | null;
  actionId: string | null;
}

async function upsertDailyUpdates(
  client: PoolClient,
  updates: ResolvedDailyUpdate[],
  sheet: string,
): Promise<void> {
  const chunkSize = 1_000;
  for (let offset = 0; offset < updates.length; offset += chunkSize) {
    const values = updates.slice(offset, offset + chunkSize).map((update) => ({
      department_id: update.departmentId,
      member_id: update.memberId,
      goal_id: update.goalId,
      action_id: update.actionId,
      target_id: update.targetId,
      update_date: update.record.updateDate,
      activity: update.record.activity,
      status: update.record.status,
      entry_type: update.record.entryType,
      note: update.record.note,
      source_sheet: sheet,
      source_row: update.record.sourceRow,
      source_cell: update.record.sourceCell,
    }));

    await client.query(
      `INSERT INTO daily_updates (
         department_id, member_id, goal_id, action_id, target_id,
         update_date, activity, status, entry_type, note,
         source_sheet, source_row, source_cell
       )
       SELECT department_id, member_id, goal_id, action_id, target_id,
              update_date, activity, status, entry_type, note,
              source_sheet, source_row, source_cell
         FROM jsonb_to_recordset($1::jsonb) AS imported(
           department_id UUID,
           member_id UUID,
           goal_id UUID,
           action_id UUID,
           target_id UUID,
           update_date DATE,
           activity TEXT,
           status VARCHAR(30),
           entry_type VARCHAR(30),
           note TEXT,
           source_sheet VARCHAR(100),
           source_row INTEGER,
           source_cell VARCHAR(30)
         )
       ON CONFLICT (source_sheet, source_row, update_date)
         WHERE source_sheet IN ('Management', 'Operation') AND source_row IS NOT NULL
       DO UPDATE SET
         department_id = EXCLUDED.department_id,
         member_id = EXCLUDED.member_id,
         goal_id = EXCLUDED.goal_id,
         action_id = EXCLUDED.action_id,
         target_id = EXCLUDED.target_id,
         activity = EXCLUDED.activity,
         status = EXCLUDED.status,
         entry_type = EXCLUDED.entry_type,
         note = EXCLUDED.note,
         source_cell = EXCLUDED.source_cell,
         updated_at = NOW()`,
      [JSON.stringify(values)],
    );
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function printDryRun(
  parsedSheets: { worksheet: ExcelJS.Worksheet; parsed: ParsedSheet }[],
): void {
  console.log("DRY RUN: parsed workbook only; no PostgreSQL writes were performed.");

  for (const { worksheet, parsed } of parsedSheets) {
    console.log(
      `${worksheet.name.trim()}: ${parsed.departments.length} departments, ` +
        `${parsed.members.length} members, ${parsed.goals.length} goals, ` +
        `${parsed.targets.length} targets, ${parsed.actions.length} actions, ` +
        `${parsed.dailyUpdates.length} daily updates`,
    );
  }

  const samples: string[] = [];
  for (let actionIndex = 0; samples.length < 5; actionIndex += 1) {
    let foundAction = false;

    for (const { worksheet, parsed } of parsedSheets) {
      const action = parsed.actions[actionIndex];
      if (!action) continue;
      foundAction = true;

      const goal = parsed.goals.find((record) => record.key === action.goalKey);
      const member = parsed.members.find((record) => record.key === action.memberKey);
      const department = goal
        ? parsed.departments.find((record) => record.key === goal.departmentKey)
        : null;

      if (department && member && goal) {
        samples.push(
          `[${worksheet.name.trim()}] ${department.name} → ${member.name} → ` +
            `${goal.title} → ${action.code} ${action.title}`,
        );
      }

      if (samples.length === 5) break;
    }

    if (!foundAction) break;
  }

  console.log("Sample Department → Member → Goal → Action records:");
  samples.forEach((sample, index) => console.log(`${index + 1}. ${sample}`));
}

async function importStopData(dryRun = false, structureOnly = false): Promise<void> {
  const filePath = path.join(process.cwd(), "imports", "STOP -CAC 25_26.xlsx");
  if (!fs.existsSync(filePath)) throw new Error(`Excel file not found: ${filePath}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheetsToProcess = workbook.worksheets.filter((worksheet) =>
    ALLOWED_SHEETS.has(worksheet.name.trim()),
  );
  if (sheetsToProcess.length !== ALLOWED_SHEETS.size) {
    throw new Error("The workbook must contain both Management and Operation sheets");
  }

  if (dryRun) {
    printDryRun(
      sheetsToProcess.map((worksheet) => ({
        worksheet,
        parsed: parseSheet(worksheet),
      })),
    );
    return;
  }

  const teamMembers = await readTeamAlignment(
    path.join(process.cwd(), "imports", TEAM_ALIGNMENT_FILE),
  );
  const client = await db.connect();
  let batchId: string | null = null;
  let transactionStarted = false;

  try {
    const batchResult = await client.query(
      `INSERT INTO import_batches (file_name, status) VALUES ($1, 'STARTED') RETURNING id`,
      [path.basename(filePath)],
    );
    batchId = batchResult.rows[0].id;

    const parsedSheets = sheetsToProcess.map((worksheet) => ({
      worksheet,
      parsed: parseSheet(worksheet),
    }));
    const structureCounts = parsedSheets.reduce(
      (counts, { parsed }) => ({
        departments: counts.departments + parsed.departments.length,
        members: counts.members + parsed.members.length,
        goals: counts.goals + parsed.goals.length,
        targets: counts.targets + parsed.targets.length,
        actions: counts.actions + parsed.actions.length,
        actionAssignees: counts.actionAssignees + parsed.actions.length,
      }),
      { departments: 0, members: 0, goals: 0, targets: 0, actions: 0, actionAssignees: 0 },
    );

    for (const { worksheet, parsed } of parsedSheets) {
      console.log(
        `${worksheet.name.trim()}: header row ${parsed.headerRow}, ` +
          `${parsed.dailyColumns.length} activity/status date pairs, ` +
          `${parsed.departments.length} departments, ${parsed.members.length} members, ` +
          `${parsed.goals.length} goals, ${parsed.targets.length} targets, ` +
          `${parsed.actions.length} actions, ${parsed.dailyUpdates.length} daily updates`,
      );
    }

    await client.query("BEGIN");
    transactionStarted = true;

    for (const { worksheet, parsed } of parsedSheets) {
      const sheet = worksheet.name.trim();
      const departmentIds = new Map<string, string>();
      const memberIds = new Map<string, string>();
      const goalIds = new Map<string, string>();
      const targetIds = new Map<string, string>();
      const actionIds = new Map<string, string>();

      for (const department of parsed.departments) {
        departmentIds.set(
          department.key,
          await getOrInsertDepartment(client, department, sheet),
        );
      }

      for (const member of parsed.members) {
        const departmentId = departmentIds.get(member.departmentKey);
        if (!departmentId) throw new Error(`Missing department for ${sheet} row ${member.sourceRow}`);

        const memberId = await getExistingMember(client, member, sheet, teamMembers);
        memberIds.set(member.key, memberId);
        await client.query(
          `INSERT INTO department_members (department_id, member_id)
           VALUES ($1, $2)
           ON CONFLICT (department_id, member_id) DO NOTHING`,
          [departmentId, memberId],
        );
      }

      for (const goal of parsed.goals) {
        const departmentId = departmentIds.get(goal.departmentKey);
        const memberId = memberIds.get(goal.memberKey);
        if (!departmentId || !memberId) {
          throw new Error(`Missing goal owner for ${sheet} row ${goal.sourceRow}`);
        }
        goalIds.set(
          goal.key,
          await getOrInsertGoal(client, goal, departmentId, memberId, sheet),
        );
      }

      for (const target of parsed.targets) {
        const goalId = goalIds.get(target.goalKey);
        if (!goalId) throw new Error(`Missing target goal for ${sheet} row ${target.sourceRow}`);
        targetIds.set(target.key, await getOrInsertTarget(client, target, goalId, sheet));
      }

      for (const action of parsed.actions) {
        const goalId = goalIds.get(action.goalKey);
        const memberId = memberIds.get(action.memberKey);
        if (!goalId || !memberId) {
          throw new Error(`Missing action owner for ${sheet} row ${action.sourceRow}`);
        }

        const actionId = await getOrInsertAction(client, action, goalId, sheet);
        actionIds.set(action.key, actionId);
        await client.query(
          `INSERT INTO action_assignees (action_id, member_id)
           VALUES ($1, $2)
           ON CONFLICT (action_id, member_id) DO NOTHING`,
          [actionId, memberId],
        );
      }

      if (!structureOnly) {
        const resolvedUpdates: ResolvedDailyUpdate[] = [];
        for (const update of parsed.dailyUpdates) {
          const departmentId = departmentIds.get(update.departmentKey);
          const memberId = update.memberKey ? memberIds.get(update.memberKey) : null;
          if (!departmentId || (update.memberKey && !memberId)) {
            throw new Error(`Missing daily update scope for ${sheet} row ${update.sourceRow}`);
          }

          resolvedUpdates.push({
            record: update,
            departmentId,
            memberId: memberId ?? null,
            goalId: update.goalKey ? (goalIds.get(update.goalKey) ?? null) : null,
            targetId: update.targetKey ? (targetIds.get(update.targetKey) ?? null) : null,
            actionId: update.actionKey ? (actionIds.get(update.actionKey) ?? null) : null,
          });
        }
        await upsertDailyUpdates(client, resolvedUpdates, sheet);
      }
    }

    await client.query(
      `UPDATE import_batches
          SET status = 'COMPLETED', completed_at = NOW(), notes = $2
        WHERE id = $1`,
      [batchId, `Imported sheets: ${[...ALLOWED_SHEETS].join(", ")}`],
    );
    await client.query("COMMIT");
    transactionStarted = false;
    console.log(`Import batch ${batchId} completed successfully.`);
    if (structureOnly) {
      console.log(
        `Imported counts: ${structureCounts.departments} departments, ` +
          `${structureCounts.members} members, ${structureCounts.goals} goals, ` +
          `${structureCounts.targets} targets, ${structureCounts.actions} actions, ` +
          `${structureCounts.actionAssignees} action assignees, 0 daily updates`,
      );
    }
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
      transactionStarted = false;
    }

    if (batchId) {
      try {
        await client.query(
          `UPDATE import_batches
              SET status = 'FAILED', completed_at = NOW(), notes = $2
            WHERE id = $1`,
          [batchId, errorMessage(error).slice(0, 5000)],
        );
      } catch (batchError) {
        console.error("Could not mark the import batch as FAILED:", batchError);
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  importStopData(
    process.argv.includes("--dry-run"),
    process.argv.includes("--structure-only"),
  )
    .catch((error) => {
      console.error("Import failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.end();
    });
}
