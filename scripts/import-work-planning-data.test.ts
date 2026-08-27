import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import ExcelJS from "exceljs";

import {
  groupSubGoals,
  parseSubGoalsWorksheet,
  parseTasksWorksheet,
  readSubGoals,
  readTasks,
} from "./import-work-planning-data";

test("Sub Goal parsing accepts only explicit A/B/C codes and follows title priority", () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Management");

  worksheet.addRow(["A1 - Inline title", "Column B detail", "Column C detail"]);
  worksheet.addRow(["B 2", "Column B title", "Column C description"]);
  worksheet.addRow(["C 3 :", "", "Column C is not a title fallback"]);
  worksheet.addRow(["A 4 Plain inline title", "Unused fallback", ""]);
  worksheet.addRow(["M1", "Management context", ""]);
  worksheet.addRow(["S 2", "Sales context", ""]);
  worksheet.addRow(["O3", "Operations context", ""]);
  worksheet.addRow(["Key Objective A", "Heading", ""]);
  worksheet.addRow(["Objective A", "Heading", ""]);

  const records = parseSubGoalsWorksheet(worksheet, "STOP.xlsx");

  assert.equal(records.length, 4);
  assert.deepEqual(records.map((record) => record.sourceCode), ["A 1", "B 2", "C 3", "A 4"]);
  assert.equal(records[0].title, "Inline title");
  assert.equal(records[0].description, "Column B detail\n\nColumn C detail");
  assert.equal(records[1].title, "Column B title");
  assert.equal(records[1].description, "Column C description");
  assert.equal(records[2].title, "");
  assert.match(records[2].validationError ?? "", /no title/i);
  assert.equal(records[3].title, "Plain inline title");
});

test("Task parsing carries categories forward and ignores category-only rows", () => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Task Type");
  worksheet.addRow(["Title", "Task"]);
  worksheet.addRow(["CGI", "CAD Conversion"]);
  worksheet.addRow(["", "Modeling"]);
  worksheet.addRow(["Sales", ""]);

  const records = parseTasksWorksheet(worksheet, "CAC Projects.xlsx");

  assert.deepEqual(
    records.map(({ category, title, validationError }) => ({ category, title, validationError })),
    [
      { category: "CGI", title: "CAD Conversion", validationError: null },
      { category: "CGI", title: "Modeling", validationError: null },
    ],
  );
});

test("Sub Goals deduplicate by global key and normalized title while retaining every source row", () => {
  const workbook = new ExcelJS.Workbook();
  const operation = workbook.addWorksheet("Operation");
  const management = workbook.addWorksheet("Management");
  operation.addRow(["A 1", "Shared Goal", "Operation detail"]);
  management.addRow(["A1", " shared   goal ", "Management detail"]);
  management.addRow(["B1", "Shared Goal", "Different key"]);

  const sources = [
    ...parseSubGoalsWorksheet(operation, "STOP.xlsx"),
    ...parseSubGoalsWorksheet(management, "STOP.xlsx"),
  ];
  const groups = groupSubGoals(sources);

  assert.equal(groups.length, 2);
  assert.equal(groups.find((group) => group.canonical.keyCode === "KEY_A")?.records.length, 2);
  assert.deepEqual(
    groups.find((group) => group.canonical.keyCode === "KEY_A")?.records.map((source) => source.sheet),
    ["Operation", "Management"],
  );
});

const suppliedProjects = path.join(process.cwd(), "imports", "CAC Projects.xlsx");
const suppliedStop = path.join(process.cwd(), "imports", "STOP -CAC 26_27.xlsx");
const suppliedWorkbooksAvailable = fs.existsSync(suppliedProjects) && fs.existsSync(suppliedStop);

test("supplied workbooks expose all 25 tasks and both STOP sheets", {
  skip: suppliedWorkbooksAvailable ? false : "Local import workbooks are not present.",
}, async () => {
  const [tasks, subGoals] = await Promise.all([
    readTasks(suppliedProjects),
    readSubGoals(suppliedStop),
  ]);

  const expectedTasks = [
    ["CGI", "CAD Conversion"],
    ["CGI", "Modeling"],
    ["CGI", "Texturing"],
    ["CGI", "Lighting"],
    ["CGI", "Render"],
    ["CGI", "Animation"],
    ["CGI", "Rework"],
    ["Editing", "Timeline/Tracing"],
    ["Editing", "Rough Cut"],
    ["Editing", "Music Reference"],
    ["Editing", "Final Cut"],
    ["Editing", "Color Grading"],
    ["Editing", "Rework"],
    ["Post Work", "Retouch"],
    ["Post Work", "Color Correction"],
    ["Post Work", "Composition"],
    ["Post Work", "Rework"],
    ["AI Work", "Reference"],
    ["AI Work", "Image Generate"],
    ["AI Work", "Motion Generate"],
    ["AI Work", "Song Generate"],
    ["AI Work", "Rework"],
    ["Overlook", "QC"],
    ["Overlook", "Team Coordination"],
    ["Overlook", "Client Coordination"],
  ];

  assert.equal(tasks.length, 25);
  assert.deepEqual(tasks.map((task) => [task.category, task.title]), expectedTasks);
  assert.ok(tasks.every((task) => task.validationError === null));
  assert.ok(subGoals.some((subGoal) => subGoal.sheet === "Operation"));
  assert.ok(subGoals.some((subGoal) => subGoal.sheet === "Management"));
  assert.ok(subGoals.every((subGoal) => /^[ABC] \d+$/.test(subGoal.sourceCode)));
  assert.ok(subGoals.some((subGoal) => subGoal.validationError));
  assert.ok(subGoals.some((subGoal) => subGoal.title.length > 300));
});

