import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import ExcelJS from "exceljs";
import {
  isUsableActivity,
  normalizeStatus,
  readHistoricalWorkRows,
  resolveProject,
  resolveTask,
  resolveTeamAlignmentName,
  type ExistingProject,
  type ExistingTask,
  type TeamAlignmentMember,
} from "./map-stop-historical-assignments";

const teamMembers: TeamAlignmentMember[] = [
  { name: "ABHJIT JAMBHALE", team: "CGI", sourceRow: 2 },
  { name: "OMKAR CHAVAN", team: "EDITING", sourceRow: 3 },
  { name: "OMKAR SHINDE", team: "CGI", sourceRow: 4 },
  { name: "DINESH MORE", team: "POST - PRODUCTION", sourceRow: 5 },
];

function project(overrides: Partial<ExistingProject>): ExistingProject {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? "Project",
    code: overrides.code ?? null,
    master_job_no: overrides.master_job_no ?? null,
    client_name: overrides.client_name ?? null,
    is_active: overrides.is_active ?? true,
  };
}

function task(category: string, title: string): ExistingTask {
  return { id: crypto.randomUUID(), category, title, is_active: true };
}

const canonicalTasks = [
  task("CGI", "Lighting"),
  task("CGI", "Modeling"),
  task("CGI", "Texturing"),
  task("Editing", "Rough Cut"),
  task("Post Work", "Retouch"),
  task("Overlook", "QC"),
];

test("member matching uses exact, confirmed spelling, and unique first-name evidence", () => {
  assert.equal(resolveTeamAlignmentName("ABHIJIT", teamMembers).canonicalName, "ABHJIT JAMBHALE");
  assert.equal(resolveTeamAlignmentName("dinesh", teamMembers).canonicalName, "DINESH MORE");
  assert.equal(resolveTeamAlignmentName("Omkar", teamMembers).canonicalName, null);
  assert.equal(resolveTeamAlignmentName("Omkar", teamMembers).ambiguous, true);
  assert.equal(resolveTeamAlignmentName("Unknown Person", teamMembers).canonicalName, null);
});

test("project matching resolves a confirmed alias but blocks named ambiguous families", () => {
  const projects = [
    project({ name: "Tilt Brand / Wipro / Santoor Fresh Skin", master_job_no: "A1/001/2627/Tilt Brand/Wipro/Santoor Fresh Skin" }),
    project({ name: "Raymond / ColorPlus AW26 Campaign Craetive", master_job_no: "N1/014/2627/Raymond/ColorPlus AW26 Campaign Craetive" }),
    project({ name: "Raymond / ColorPlus AW26 Campaign Shoot", master_job_no: "O1/015/2627/Raymond/ColorPlus AW26 Campaign Shoot" }),
    project({ name: "Pitch / Raymond", master_job_no: "I1/009/2627/Pitch/Raymond" }),
  ];

  assert.equal(resolveProject("Santoor - lighting", projects).record?.name, projects[0].name);
  const raymond = resolveProject("Raymond - shoot coordination", projects);
  assert.equal(raymond.record, null);
  assert.match(raymond.strategy, /^AMBIGUOUS_PROJECT_FAMILY/);
});

test("project matching never selects duplicate exact project IDs", () => {
  const projects = [
    project({ name: "One", code: "K1/011/2627" }),
    project({ name: "Two", code: "K1/011/2627" }),
  ];
  const result = resolveProject("K1/011/2627 lighting", projects);
  assert.equal(result.record, null);
  assert.equal(result.strategy, "AMBIGUOUS_PROJECT_ID");
});

test("task matching is team-scoped and rejects multiple task signals", () => {
  assert.equal(resolveTask("Santoor lighting", "CGI", canonicalTasks).record?.title, "Lighting");
  assert.equal(resolveTask("Modeling and texturing", "CGI", canonicalTasks).record, null);
  assert.equal(resolveTask("Rough cut", "EDITING", canonicalTasks).record?.title, "Rough Cut");
  assert.equal(resolveTask("Retouching", "POST - PRODUCTION", canonicalTasks).record?.title, "Retouch");
  assert.equal(resolveTask("General coordination", "Admin", canonicalTasks).record, null);
});

test("status and activity parsing separate work from status/attendance markers", () => {
  assert.equal(normalizeStatus("Progress"), "IN_PROGRESS");
  assert.equal(normalizeStatus("not started"), "NOT_STARTED");
  assert.equal(normalizeStatus("unknown"), null);
  assert.equal(isUsableActivity("DONE"), false);
  assert.equal(isUsableActivity("Approved Leave"), false);
  assert.equal(isUsableActivity("Santoor lighting"), true);
});

test("workbook parsing preserves sheet, row, cell, member, and rejects out-of-FY dates", async () => {
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "stop-history-test-"));
  const workbookPath = path.join(tempDirectory, "STOP.xlsx");
  try {
    const workbook = new ExcelJS.Workbook();
    for (const sheetName of ["Operation", "Management"]) {
      const sheet = workbook.addWorksheet(sheetName);
      sheet.getCell("G1").value = new Date(Date.UTC(2026, 3, 1));
      sheet.getCell("I1").value = new Date(Date.UTC(2026, 0, 2));
      sheet.getCell("A2").value = "ABHIJIT";
      sheet.getCell("A3").value = "Key Objective A";
      sheet.getCell("A4").value = "A 1";
      sheet.getCell("B4").value = "Lighting quality";
      sheet.getCell("G4").value = "Santoor lighting";
      sheet.getCell("H4").value = "DONE";
      sheet.getCell("I4").value = "Santoor rework";
      sheet.getCell("J4").value = "PROGRESS";
    }
    await workbook.xlsx.writeFile(workbookPath);
    const records = await readHistoricalWorkRows(workbookPath, teamMembers);
    assert.equal(records.length, 4);
    assert.deepEqual(
      records.map((record) => [record.sheet, record.row, record.cell, record.sourceMember, record.workDate, record.status]),
      [
        ["Operation", 4, "G4", "ABHIJIT", "2026-04-01", "DONE"],
        ["Operation", 4, "I4", "ABHIJIT", null, "IN_PROGRESS"],
        ["Management", 4, "G4", "ABHIJIT", "2026-04-01", "DONE"],
        ["Management", 4, "I4", "ABHIJIT", null, "IN_PROGRESS"],
      ],
    );
  } finally {
    await fs.rm(tempDirectory, { recursive: true, force: true });
  }
});
