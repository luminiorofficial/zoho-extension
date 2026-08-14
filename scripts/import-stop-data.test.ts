import assert from "node:assert/strict";
import test from "node:test";

import ExcelJS from "exceljs";

import { parseSheet } from "./import-stop-data";

function buildWorksheet(): ExcelJS.Worksheet {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Management");

  worksheet.getCell("D1").value = new Date(Date.UTC(2025, 3, 1));
  worksheet.getCell("E1").value = "D/NS/P";
  worksheet.getCell("F1").value = new Date(Date.UTC(2025, 3, 2));
  worksheet.getCell("G1").value = "STATUS";

  worksheet.getCell("A2").value = "Marketing (Mon)";
  worksheet.getCell("D2").value = "Department planning update";
  worksheet.getCell("E2").value = "Done";

  worksheet.getCell("A3").value = "Harsh Palvia";
  worksheet.getCell("A3").font = { bold: true };

  worksheet.getCell("A4").value = "Key Objective A: Delivery";
  worksheet.getCell("A4").font = { bold: true };
  worksheet.getCell("B4").value = "Deliver on time";
  worksheet.getCell("D4").value = "Partially complete";
  worksheet.getCell("E4").value = "DONE, PROGRESS";

  worksheet.getCell("A5").value = "C 3 MANAS DHARA TANVI SHASHI";
  worksheet.getCell("F5").value = "Prepare review";
  worksheet.getCell("G5").value = "Not Started";

  return worksheet;
}

test("parseSheet preserves every populated daily pair and complete cell provenance", () => {
  const parsed = parseSheet(buildWorksheet());

  assert.equal(parsed.departments.length, 1);
  assert.equal(parsed.departments[0].sourceCell, "A2");
  assert.equal(parsed.members.length, 1);
  assert.equal(parsed.members[0].sourceCell, "A3");
  assert.equal(parsed.goals.length, 1);
  assert.equal(parsed.goals[0].sourceCell, "A4:B4");
  assert.equal(parsed.targets.length, 1);
  assert.equal(parsed.targets[0].sourceCell, "B4");

  assert.equal(parsed.dailyUpdates.length, 3);
  assert.equal(parsed.dailyUpdates[0].memberKey, null);
  assert.equal(parsed.dailyUpdates[0].sourceCell, "D2:E2");
  assert.equal(parsed.dailyUpdates[1].status, "IN_PROGRESS");
  assert.equal(parsed.dailyUpdates[1].note, null);
  assert.equal(parsed.dailyUpdates[1].sourceCell, "D4:E4");
  assert.equal(parsed.dailyUpdates[2].sourceCell, "F5:G5");
});

test("parseSheet recognizes an action code followed by an unseparated title", () => {
  const parsed = parseSheet(buildWorksheet());

  assert.equal(parsed.actions.length, 1);
  assert.equal(parsed.actions[0].code, "C3");
  assert.equal(parsed.actions[0].title, "MANAS DHARA TANVI SHASHI");
  assert.equal(parsed.actions[0].sourceCell, "A5");
  assert.equal(parsed.dailyUpdates[2].actionKey, parsed.actions[0].key);
});
