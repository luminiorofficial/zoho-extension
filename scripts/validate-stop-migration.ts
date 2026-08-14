import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import { parseSheet } from "./import-stop-data";

const SHEETS = ["Management", "Operation"] as const;
const ENTITIES = [
  "departments",
  "members",
  "goals",
  "targets",
  "actions",
  "daily_updates",
] as const;

type Entity = (typeof ENTITIES)[number];

interface ValidationSummary {
  expected: Record<Entity, number>;
  imported: Record<Entity, number>;
  mismatches: Record<Entity, number>;
  skippedRows: number;
  skippedDailyPairs: number;
  duplicateGroups: number;
  sourceDuplicateGroups: number;
  orphanedRecords: number;
  missingProvenance: number;
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

function getCellText(cell: ExcelJS.Cell): string {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return String(value).trim();
  if ("richText" in value) return value.richText.map((part) => part.text).join("").trim();
  if ("text" in value && typeof value.text === "string") return value.text.trim();
  if ("result" in value && value.result !== null && value.result !== undefined) {
    return String(value.result).trim();
  }
  return String(cell.text ?? "").trim();
}

function blankCounts(): Record<Entity, number> {
  return Object.fromEntries(ENTITIES.map((entity) => [entity, 0])) as Record<Entity, number>;
}

function equalNullable(left: unknown, right: unknown): boolean {
  return (left ?? null) === (right ?? null);
}

function addMismatch(
  counts: Record<Entity, number>,
  samples: string[],
  entity: Entity,
  sheet: string,
  row: number,
  reason: string,
): void {
  counts[entity] += 1;
  if (samples.length < 12) samples.push(`${entity} ${sheet}:${row} — ${reason}`);
}

async function run(): Promise<void> {
  loadLocalEnvironment();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

  const workbookPath = path.join(process.cwd(), "imports", "STOP -CAC 25_26.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);

  const parsedSheets = SHEETS.map((sheet) => {
    const worksheet = workbook.getWorksheet(sheet);
    if (!worksheet) throw new Error(`Missing workbook sheet: ${sheet}`);
    return { sheet, worksheet, parsed: parseSheet(worksheet) };
  });

  const summary: ValidationSummary = {
    expected: blankCounts(),
    imported: blankCounts(),
    mismatches: blankCounts(),
    skippedRows: 0,
    skippedDailyPairs: 0,
    duplicateGroups: 0,
    sourceDuplicateGroups: 0,
    orphanedRecords: 0,
    missingProvenance: 0,
  };
  const mismatchSamples: string[] = [];
  const skippedRows = new Set<string>();

  for (const { sheet, worksheet, parsed } of parsedSheets) {
    summary.expected.departments += parsed.departments.length;
    summary.expected.members += parsed.members.length;
    summary.expected.goals += parsed.goals.length;
    summary.expected.targets += parsed.targets.length;
    summary.expected.actions += parsed.actions.length;
    summary.expected.daily_updates += parsed.dailyUpdates.length;

    const parsedDailyKeys = new Set(
      parsed.dailyUpdates.map((update) => `${update.sourceRow}|${update.updateDate}`),
    );
    for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      if (rowNumber === parsed.headerRow) continue;
      for (const columns of parsed.dailyColumns) {
        const activity = getCellText(worksheet.getRow(rowNumber).getCell(columns.activityColumn));
        const status = getCellText(worksheet.getRow(rowNumber).getCell(columns.statusColumn));
        if (!activity && !status) continue;
        if (parsedDailyKeys.has(`${rowNumber}|${columns.updateDate}`)) continue;
        summary.skippedDailyPairs += 1;
        skippedRows.add(`${sheet}:${rowNumber}`);
      }
    }

    const dates = parsed.dailyColumns.map((column) => column.updateDate);
    if (new Set(dates).size !== dates.length) {
      mismatchSamples.push(`${sheet} has duplicate date columns.`);
    }
    for (let index = 1; index < dates.length; index += 1) {
      if ((Date.parse(dates[index]) - Date.parse(dates[index - 1])) / 86_400_000 !== 1) {
        mismatchSamples.push(`${sheet} has a date gap before ${dates[index]}.`);
      }
    }
  }
  summary.skippedRows = skippedRows.size;

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
    max: 1,
  });

  try {
    const countResult = await pool.query<{ entity: Entity; count: string }>(`
      SELECT entity, COUNT(*)::text AS count
        FROM (
          SELECT 'departments'::text AS entity, source_sheet FROM departments
          UNION ALL SELECT 'members', source_sheet FROM members
          UNION ALL SELECT 'goals', source_sheet FROM goals
          UNION ALL SELECT 'targets', source_sheet FROM targets
          UNION ALL SELECT 'actions', source_sheet FROM actions
          UNION ALL SELECT 'daily_updates', source_sheet FROM daily_updates
        ) imported
       WHERE source_sheet IN ('Management', 'Operation')
       GROUP BY entity
    `);
    for (const row of countResult.rows) summary.imported[row.entity] = Number(row.count);

    for (const { sheet, parsed } of parsedSheets) {
      const departments = await pool.query<{
        name: string;
        source_row: number;
        source_cell: string | null;
      }>("SELECT name, source_row, source_cell FROM departments WHERE source_sheet = $1", [sheet]);
      const departmentByRow = new Map(departments.rows.map((row) => [row.source_row, row]));
      for (const expected of parsed.departments) {
        const actual = departmentByRow.get(expected.sourceRow);
        if (!actual || actual.name !== expected.name || actual.source_cell !== expected.sourceCell) {
          addMismatch(summary.mismatches, mismatchSamples, "departments", sheet, expected.sourceRow, "field or provenance mismatch");
        }
      }

      const members = await pool.query<{
        name: string;
        source_row: number;
        source_cell: string | null;
        department_rows: number[];
      }>(`
        SELECT m.name, m.source_row, m.source_cell,
               ARRAY_REMOVE(ARRAY_AGG(d.source_row ORDER BY d.source_row), NULL) AS department_rows
          FROM members m
          LEFT JOIN department_members dm ON dm.member_id = m.id
          LEFT JOIN departments d ON d.id = dm.department_id AND d.source_sheet = $1
         WHERE m.source_sheet = $1
         GROUP BY m.id
      `, [sheet]);
      const memberByRow = new Map(members.rows.map((row) => [row.source_row, row]));
      for (const expected of parsed.members) {
        const actual = memberByRow.get(expected.sourceRow);
        const departmentRow = parsed.departments.find(
          (department) => department.key === expected.departmentKey,
        )?.sourceRow;
        if (
          !actual ||
          actual.name !== expected.name ||
          actual.source_cell !== expected.sourceCell ||
          !actual.department_rows.includes(departmentRow ?? -1)
        ) {
          addMismatch(summary.mismatches, mismatchSamples, "members", sheet, expected.sourceRow, "field, provenance, or department mismatch");
        }
      }

      const goals = await pool.query<{
        source_row: number;
        source_cell: string | null;
        code: string | null;
        title: string;
        description: string | null;
        department_row: number;
        member_row: number | null;
      }>(`
        SELECT g.source_row, g.source_cell, g.code, g.title, g.description,
               d.source_row AS department_row, m.source_row AS member_row
          FROM goals g
          JOIN departments d ON d.id = g.department_id
          LEFT JOIN members m ON m.id = g.owner_member_id
         WHERE g.source_sheet = $1
      `, [sheet]);
      const goalByRow = new Map(goals.rows.map((row) => [row.source_row, row]));
      for (const expected of parsed.goals) {
        const actual = goalByRow.get(expected.sourceRow);
        const departmentRow = parsed.departments.find(
          (department) => department.key === expected.departmentKey,
        )?.sourceRow;
        const memberRow = parsed.members.find(
          (member) => member.key === expected.memberKey,
        )?.sourceRow;
        if (
          !actual ||
          actual.source_cell !== expected.sourceCell ||
          !equalNullable(actual.code, expected.code) ||
          actual.title !== expected.title ||
          !equalNullable(actual.description, expected.description) ||
          actual.department_row !== departmentRow ||
          actual.member_row !== memberRow
        ) {
          addMismatch(summary.mismatches, mismatchSamples, "goals", sheet, expected.sourceRow, "field, provenance, or owner mismatch");
        }
      }

      const targets = await pool.query<{
        source_row: number;
        source_cell: string | null;
        title: string;
        target_text: string | null;
        goal_row: number;
      }>(`
        SELECT t.source_row, t.source_cell, t.title, t.target_text, g.source_row AS goal_row
          FROM targets t
          JOIN goals g ON g.id = t.goal_id
         WHERE t.source_sheet = $1
      `, [sheet]);
      const targetByKey = new Map(
        targets.rows.map((row) => [`${row.goal_row}|${row.source_row}|${row.title}`, row]),
      );
      for (const expected of parsed.targets) {
        const goalRow = parsed.goals.find((goal) => goal.key === expected.goalKey)?.sourceRow;
        const actual = targetByKey.get(`${goalRow}|${expected.sourceRow}|${expected.title}`);
        if (
          !actual ||
          actual.source_cell !== expected.sourceCell ||
          !equalNullable(actual.target_text, expected.targetText)
        ) {
          addMismatch(summary.mismatches, mismatchSamples, "targets", sheet, expected.sourceRow, "field, provenance, or goal mismatch");
        }
      }

      const actions = await pool.query<{
        source_row: number;
        source_cell: string | null;
        code: string | null;
        title: string;
        description: string | null;
        goal_row: number;
        member_rows: number[];
      }>(`
        SELECT a.source_row, a.source_cell, a.code, a.title, a.description,
               g.source_row AS goal_row,
               ARRAY_REMOVE(ARRAY_AGG(m.source_row ORDER BY m.source_row), NULL) AS member_rows
          FROM actions a
          JOIN goals g ON g.id = a.goal_id
          LEFT JOIN action_assignees aa ON aa.action_id = a.id
          LEFT JOIN members m ON m.id = aa.member_id
         WHERE a.source_sheet = $1
         GROUP BY a.id, g.source_row
      `, [sheet]);
      const actionByKey = new Map(
        actions.rows.map((row) => [`${row.goal_row}|${row.source_row}`, row]),
      );
      for (const expected of parsed.actions) {
        const goalRow = parsed.goals.find((goal) => goal.key === expected.goalKey)?.sourceRow;
        const memberRow = parsed.members.find(
          (member) => member.key === expected.memberKey,
        )?.sourceRow;
        const actual = actionByKey.get(`${goalRow}|${expected.sourceRow}`);
        if (
          !actual ||
          actual.source_cell !== expected.sourceCell ||
          !equalNullable(actual.code, expected.code) ||
          actual.title !== expected.title ||
          !equalNullable(actual.description, expected.description) ||
          !actual.member_rows.includes(memberRow ?? -1)
        ) {
          addMismatch(summary.mismatches, mismatchSamples, "actions", sheet, expected.sourceRow, "field, provenance, goal, or assignee mismatch");
        }
      }

      const updates = await pool.query<{
        source_row: number;
        source_cell: string | null;
        update_date: string;
        activity: string | null;
        status: string | null;
        entry_type: string;
        note: string | null;
        department_row: number | null;
        member_row: number | null;
        goal_row: number | null;
        target_row: number | null;
        action_row: number | null;
      }>(`
        SELECT u.source_row, u.source_cell, u.update_date::text, u.activity, u.status,
               u.entry_type, u.note, d.source_row AS department_row,
               m.source_row AS member_row, g.source_row AS goal_row,
               t.source_row AS target_row, a.source_row AS action_row
          FROM daily_updates u
          LEFT JOIN departments d ON d.id = u.department_id
          LEFT JOIN members m ON m.id = u.member_id
          LEFT JOIN goals g ON g.id = u.goal_id
          LEFT JOIN targets t ON t.id = u.target_id
          LEFT JOIN actions a ON a.id = u.action_id
         WHERE u.source_sheet = $1
      `, [sheet]);
      const updateByKey = new Map(
        updates.rows.map((row) => [`${row.source_row}|${row.update_date}`, row]),
      );
      for (const expected of parsed.dailyUpdates) {
        const actual = updateByKey.get(`${expected.sourceRow}|${expected.updateDate}`);
        const departmentRow = parsed.departments.find(
          (department) => department.key === expected.departmentKey,
        )?.sourceRow;
        const memberRow = parsed.members.find(
          (member) => member.key === expected.memberKey,
        )?.sourceRow;
        const goalRow = parsed.goals.find((goal) => goal.key === expected.goalKey)?.sourceRow;
        const targetRow = parsed.targets.find(
          (target) => target.key === expected.targetKey,
        )?.sourceRow;
        const actionRow = parsed.actions.find(
          (action) => action.key === expected.actionKey,
        )?.sourceRow;
        if (
          !actual ||
          actual.source_cell !== expected.sourceCell ||
          actual.activity !== expected.activity ||
          actual.status !== expected.status ||
          actual.entry_type !== expected.entryType ||
          actual.note !== expected.note ||
          actual.department_row !== departmentRow ||
          !equalNullable(actual.member_row, memberRow) ||
          !equalNullable(actual.goal_row, goalRow) ||
          !equalNullable(actual.target_row, targetRow) ||
          !equalNullable(actual.action_row, actionRow)
        ) {
          addMismatch(summary.mismatches, mismatchSamples, "daily_updates", sheet, expected.sourceRow, `mapping mismatch on ${expected.updateDate}`);
        }
      }
    }

    for (const entity of ENTITIES) {
      const countDelta = Math.abs(summary.expected[entity] - summary.imported[entity]);
      summary.mismatches[entity] = Math.max(summary.mismatches[entity], countDelta);
    }

    const provenance = await pool.query<{ missing: string }>(`
      SELECT SUM(missing)::text AS missing
        FROM (
          SELECT COUNT(*) FILTER (WHERE source_row IS NULL OR source_cell IS NULL) AS missing FROM departments WHERE source_sheet IN ('Management', 'Operation')
          UNION ALL SELECT COUNT(*) FILTER (WHERE source_row IS NULL OR source_cell IS NULL) FROM members WHERE source_sheet IN ('Management', 'Operation')
          UNION ALL SELECT COUNT(*) FILTER (WHERE source_row IS NULL OR source_cell IS NULL) FROM goals WHERE source_sheet IN ('Management', 'Operation')
          UNION ALL SELECT COUNT(*) FILTER (WHERE source_row IS NULL OR source_cell IS NULL) FROM targets WHERE source_sheet IN ('Management', 'Operation')
          UNION ALL SELECT COUNT(*) FILTER (WHERE source_row IS NULL OR source_cell IS NULL) FROM actions WHERE source_sheet IN ('Management', 'Operation')
          UNION ALL SELECT COUNT(*) FILTER (WHERE source_row IS NULL OR source_cell IS NULL) FROM daily_updates WHERE source_sheet IN ('Management', 'Operation')
        ) lineage
    `);
    summary.missingProvenance = Number(provenance.rows[0]?.missing ?? 0);

    const duplicates = await pool.query<{ groups: string }>(`
      SELECT COUNT(*)::text AS groups
        FROM (
          SELECT source_sheet, source_row FROM departments WHERE source_sheet IN ('Management', 'Operation') GROUP BY source_sheet, source_row HAVING COUNT(*) > 1
          UNION ALL SELECT source_sheet, source_row FROM members WHERE source_sheet IN ('Management', 'Operation') GROUP BY source_sheet, source_row HAVING COUNT(*) > 1
          UNION ALL SELECT source_sheet, source_row FROM goals WHERE source_sheet IN ('Management', 'Operation') GROUP BY source_sheet, source_row HAVING COUNT(*) > 1
          UNION ALL SELECT source_sheet, source_row FROM targets WHERE source_sheet IN ('Management', 'Operation') GROUP BY source_sheet, source_row, goal_id HAVING COUNT(*) > 1
          UNION ALL SELECT source_sheet, source_row FROM actions WHERE source_sheet IN ('Management', 'Operation') GROUP BY source_sheet, source_row HAVING COUNT(*) > 1
          UNION ALL SELECT source_sheet, source_row FROM daily_updates WHERE source_sheet IN ('Management', 'Operation') GROUP BY source_sheet, source_row, update_date HAVING COUNT(*) > 1
        ) duplicate_sources
    `);
    summary.duplicateGroups = Number(duplicates.rows[0]?.groups ?? 0);

    const sourceDuplicates = parsedSheets.reduce((count, { parsed }) => {
      const groups = new Map<string, number>();
      for (const goal of parsed.goals) {
        const key = `${goal.departmentKey}|${goal.memberKey}|${goal.title.toLocaleLowerCase()}`;
        groups.set(key, (groups.get(key) ?? 0) + 1);
      }
      return count + [...groups.values()].filter((groupCount) => groupCount > 1).length;
    }, 0);
    summary.sourceDuplicateGroups = sourceDuplicates;

    const orphans = await pool.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count
        FROM (
          SELECT g.id FROM goals g LEFT JOIN departments d ON d.id = g.department_id WHERE g.source_sheet IN ('Management', 'Operation') AND d.id IS NULL
          UNION ALL SELECT g.id FROM goals g LEFT JOIN department_members dm ON dm.department_id = g.department_id AND dm.member_id = g.owner_member_id WHERE g.source_sheet IN ('Management', 'Operation') AND g.owner_member_id IS NOT NULL AND dm.member_id IS NULL
          UNION ALL SELECT t.id FROM targets t LEFT JOIN goals g ON g.id = t.goal_id WHERE t.source_sheet IN ('Management', 'Operation') AND g.id IS NULL
          UNION ALL SELECT a.id FROM actions a LEFT JOIN goals g ON g.id = a.goal_id WHERE a.source_sheet IN ('Management', 'Operation') AND g.id IS NULL
          UNION ALL SELECT a.id FROM actions a LEFT JOIN action_assignees aa ON aa.action_id = a.id WHERE a.source_sheet IN ('Management', 'Operation') AND aa.action_id IS NULL
          UNION ALL SELECT u.id FROM daily_updates u LEFT JOIN departments d ON d.id = u.department_id WHERE u.source_sheet IN ('Management', 'Operation') AND d.id IS NULL
          UNION ALL SELECT u.id FROM daily_updates u LEFT JOIN members m ON m.id = u.member_id WHERE u.source_sheet IN ('Management', 'Operation') AND u.member_id IS NOT NULL AND m.id IS NULL
          UNION ALL SELECT u.id FROM daily_updates u JOIN actions a ON a.id = u.action_id WHERE u.source_sheet IN ('Management', 'Operation') AND u.goal_id IS DISTINCT FROM a.goal_id
          UNION ALL SELECT u.id FROM daily_updates u JOIN targets t ON t.id = u.target_id WHERE u.source_sheet IN ('Management', 'Operation') AND u.goal_id IS DISTINCT FROM t.goal_id
        ) orphan_rows
    `);
    summary.orphanedRecords = Number(orphans.rows[0]?.count ?? 0);
  } finally {
    await pool.end();
  }

  console.log("Excel migration validation — STOP -CAC 25_26.xlsx");
  console.table(
    ENTITIES.map((entity) => ({
      entity,
      expected: summary.expected[entity],
      imported: summary.imported[entity],
      mismatches: summary.mismatches[entity],
    })),
  );
  console.table({
    skipped_rows: summary.skippedRows,
    skipped_daily_pairs: summary.skippedDailyPairs,
    import_duplicate_groups: summary.duplicateGroups,
    source_duplicate_groups: summary.sourceDuplicateGroups,
    orphaned_records: summary.orphanedRecords,
    missing_provenance: summary.missingProvenance,
  });
  if (mismatchSamples.length > 0) {
    console.log("Mismatch samples:");
    mismatchSamples.forEach((sample) => console.log(`- ${sample}`));
  }

  const failed =
    Object.values(summary.mismatches).some((count) => count > 0) ||
    summary.skippedDailyPairs > 0 ||
    summary.duplicateGroups > 0 ||
    summary.orphanedRecords > 0 ||
    summary.missingProvenance > 0;
  if (failed) process.exitCode = 1;
}

run().catch((error) => {
  console.error("Validation failed:", error);
  process.exitCode = 1;
});
