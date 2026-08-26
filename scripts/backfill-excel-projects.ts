import fs from "node:fs";
import path from "node:path";

type CandidateRow = {
  department_id: string;
  department_name: string;
  goal_id: string | null;
  goal_title: string | null;
  member_id: string | null;
  member_name: string | null;
  update_date: string;
  activity: string;
  status: string | null;
};

type ProjectCandidate = {
  departmentId: string;
  departmentName: string;

  name: string;

  goalCounts: Map<string, number>;
  goalNames: Map<string, string>;

  memberIds: Set<string>;
  memberNames: Set<string>;

  startDate: string;
  endDate: string;

  totalActivities: number;
  doneActivities: number;

  samples: Set<string>;
};

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

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalize(value: string): string {
  return compact(value)
    .toUpperCase()
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * IMPORTANT:
 *
 * Only names in this list are allowed to become projects.
 *
 * Left side = possible wording in Excel.
 * Right side = project/client name shown in the CRM.
 *
 * We can expand this list safely after reviewing the dry-run output.
 */
const PROJECT_ALIASES: Array<[RegExp, string]> = [
  // IQOO
  [/\bIQOO\b/i, "IQOO"],
  [/\bI\s*QOO\b/i, "IQOO"],

  // Tulips
  [/\bTULIPS?\b/i, "Tulips"],

  // Naavya
  [/\bNAAVYA\b/i, "Naavya"],
  [/\bNAVYA\b/i, "Naavya"],

  // Oaksmith
  [/\bOAKSMITH\b/i, "Oaksmith"],

  // Sansaar
  [/\bSANSAAR\b/i, "Sansaar Bedding"],

  // Audi
  [/\bAUDI\b/i, "Audi"],

  // Reebok
  [/\bREEBOK\b/i, "Reebok"],

  // Titan
  [/\bTITAN\b/i, "Titan"],

  // GRT
  [/\bGRT\b/i, "GRT"],

  // Kingfisher
  [/\bKINGFISHER\b/i, "Kingfisher"],

  // Saradon
  [/\bSARADON\b/i, "Saradon"],

  // MI
  [/\bMI\b/i, "MI"],

  // LBP
  [/\bLBP\b/i, "LBP"],

  // DramBell
  [/\bDRAM\s*BELL\b/i, "DramBell"],
  [/\bDRAMBELL\b/i, "DramBell"],

  // Durex
  [/\bDUREX\b/i, "Durex"],

  // Highlander
  [/\bHIGHLANDER\b/i, "Highlander"],

  // Suncrush
  [/\bSUN\s*CRUSH\b/i, "Suncrush"],
  [/\bSUNCRUSH\b/i, "Suncrush"],

  // Ponds
  [/\bPONDS?\b/i, "Ponds"],

  // Glow & Lovely
  [/\bGLOW\s*(?:&|AND)\s*LOVELY\b/i, "Glow & Lovely"],

  // Yousta
  [/\bYOUSTA\b/i, "Yousta"],

  // Laura
  [/\bLAURA\b/i, "Laura"],

  // Cirtozen variations seen in working data
  [/\bCIRTOZEN\b/i, "Cirtozen"],
  [/\bCITROZEN\b/i, "Cirtozen"],
];

/**
 * Activity text containing these is never itself enough to create a project.
 *
 * A known PROJECT_ALIASES match can still appear beside these words:
 *
 * IQOO - Lighting    -> IQOO project
 *
 * but:
 *
 * Lighting           -> ignored
 */
const NON_PROJECT_ACTIVITY = [
  /^DESIGN POST$/i,
  /^COMP OFF$/i,
  /^LEAVE/i,
  /^ABSENT/i,
  /^HALF DAY/i,
  /^WORK ON HOLIDAY/i,
  /^\d+(?:-\d+)?\s*HRS?$/i,
  /^MEETING$/i,
  /^FEEDBACK$/i,
  /^RENDERING$/i,
  /^LIGHTING$/i,
  /^MODELLING$/i,
  /^MODELING$/i,
  /^TEXTURING$/i,
  /^RETOUCHING$/i,
  /^COMPOSITING$/i,
  /^COMPOSITION$/i,
  /^QUALITY CONTROL$/i,
  /^BACKUP$/i,
  /^RND$/i,
  /^R&D$/i,
];

function shouldIgnoreActivity(activity: string): boolean {
  const value = compact(activity);

  if (!value) return true;

  return NON_PROJECT_ACTIVITY.some((pattern) => pattern.test(value));
}

function extractProjectName(activity: string): string | null {
  const value = compact(activity);

  if (!value || shouldIgnoreActivity(value)) {
    return null;
  }

  for (const [pattern, canonicalName] of PROJECT_ALIASES) {
    if (pattern.test(value)) {
      return canonicalName;
    }
  }

  /**
   * Critical safety behaviour:
   *
   * Previously we tried to guess a project from arbitrary activity text.
   * That created 2,433 fake projects.
   *
   * Now unknown activity is simply ignored.
   */
  return null;
}

function candidateKey(
  departmentId: string,
  projectName: string,
): string {
  return `${departmentId}|${normalize(projectName)}`;
}

function chooseBestGoal(candidate: ProjectCandidate): string | null {
  const sorted = [...candidate.goalCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  );

  return sorted[0]?.[0] ?? null;
}

async function run(): Promise<void> {
  loadLocalEnvironment();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from .env.local");
  }

  const applyChanges = process.argv.includes("--apply");

  const { db } = await import("../src/lib/db");

  console.log("");
  console.log("==========================================");
  console.log("STOP EXCEL HISTORICAL PROJECT BACKFILL");
  console.log("==========================================");

  if (applyChanges) {
    console.log("MODE: APPLY - database writes ENABLED");
  } else {
    console.log("MODE: DRY RUN - NO database writes");
  }

  console.log("");
  console.log(
    "Reading Management + Operation historical daily updates...",
  );

  const result = await db.query<CandidateRow>(`
    SELECT
      COALESCE(
        du.department_id,
        g.department_id
      ) AS department_id,

      d.name AS department_name,

      COALESCE(
        du.goal_id,
        a.goal_id,
        t.goal_id
      ) AS goal_id,

      g.title AS goal_title,

      du.member_id,
      m.name AS member_name,

      du.update_date::text,
      du.activity,
      du.status

    FROM daily_updates du

    LEFT JOIN actions a
      ON a.id = du.action_id

    LEFT JOIN targets t
      ON t.id = du.target_id

    LEFT JOIN goals g
      ON g.id = COALESCE(
        du.goal_id,
        a.goal_id,
        t.goal_id
      )

    LEFT JOIN departments d
      ON d.id = COALESCE(
        du.department_id,
        g.department_id
      )

    LEFT JOIN members m
      ON m.id = du.member_id

    WHERE du.source_sheet IN (
      'Management',
      'Operation'
    )

      AND du.activity IS NOT NULL

      AND BTRIM(du.activity) <> ''

    ORDER BY
      du.update_date,
      du.source_sheet,
      du.source_row
  `);

  console.log(
    `Loaded ${result.rows.length} historical activity records.`,
  );

  const candidates =
    new Map<string, ProjectCandidate>();

  let recognisedRows = 0;
  let ignoredRows = 0;

  for (const row of result.rows) {
    if (!row.department_id) {
      ignoredRows += 1;
      continue;
    }

    const projectName =
      extractProjectName(row.activity);

    if (!projectName) {
      ignoredRows += 1;
      continue;
    }

    recognisedRows += 1;

    const key = candidateKey(
      row.department_id,
      projectName,
    );

    let candidate = candidates.get(key);

    if (!candidate) {
      candidate = {
        departmentId: row.department_id,
        departmentName:
          row.department_name ?? "Unknown Department",

        name: projectName,

        goalCounts: new Map(),
        goalNames: new Map(),

        memberIds: new Set(),
        memberNames: new Set(),

        startDate: row.update_date,
        endDate: row.update_date,

        totalActivities: 0,
        doneActivities: 0,

        samples: new Set(),
      };

      candidates.set(key, candidate);
    }

    candidate.totalActivities += 1;

    if (row.status === "DONE") {
      candidate.doneActivities += 1;
    }

    if (row.update_date < candidate.startDate) {
      candidate.startDate = row.update_date;
    }

    if (row.update_date > candidate.endDate) {
      candidate.endDate = row.update_date;
    }

    if (row.member_id) {
      candidate.memberIds.add(row.member_id);
    }

    if (row.member_name) {
      candidate.memberNames.add(row.member_name);
    }

    if (row.goal_id) {
      candidate.goalCounts.set(
        row.goal_id,
        (candidate.goalCounts.get(row.goal_id) ?? 0) + 1,
      );

      if (row.goal_title) {
        candidate.goalNames.set(
          row.goal_id,
          row.goal_title,
        );
      }
    }

    if (candidate.samples.size < 5) {
      candidate.samples.add(
        compact(row.activity),
      );
    }
  }

  console.log("");
  console.log(
    `Recognised project-linked activities: ${recognisedRows}`,
  );

  console.log(
    `Ignored/unrecognised activities: ${ignoredRows}`,
  );

  console.log(
    `Unique project/department combinations: ${candidates.size}`,
  );

  console.log("");
  console.log(
    "============== DETECTED PROJECTS ==============",
  );

  const sortedCandidates =
    [...candidates.values()].sort(
      (a, b) =>
        a.departmentName.localeCompare(
          b.departmentName,
        ) ||
        a.name.localeCompare(b.name),
    );

  for (const candidate of sortedCandidates) {
    const goalId = chooseBestGoal(candidate);

    const goalName = goalId
      ? candidate.goalNames.get(goalId) ??
        "Goal ID found"
      : "NO GOAL";

    console.log("");
    console.log(
      `${candidate.departmentName} -> ${candidate.name}`,
    );

    console.log(
      `  Goal: ${goalName}`,
    );

    console.log(
      `  Members: ${
        [...candidate.memberNames].join(", ") ||
        "None"
      }`,
    );

    console.log(
      `  Date range: ${candidate.startDate} to ${candidate.endDate}`,
    );

    console.log(
      `  Historical activities: ${candidate.totalActivities}`,
    );

    console.log("  Samples:");

    for (const sample of candidate.samples) {
      console.log(`    - ${sample}`);
    }
  }

  console.log("");
  console.log(
    "===============================================",
  );

  const noGoalCandidates =
    sortedCandidates.filter(
      (candidate) => !chooseBestGoal(candidate),
    );

  if (noGoalCandidates.length) {
    console.log("");
    console.log(
      "PROJECTS WITHOUT A RESOLVABLE GOAL",
    );

    for (const candidate of noGoalCandidates) {
      console.log(
        `  SKIP -> ${candidate.departmentName} -> ${candidate.name}`,
      );
    }
  }

  /**
   * Default mode intentionally stops here.
   */
  if (!applyChanges) {
    console.log("");
    console.log(
      "==========================================",
    );

    console.log(
      "DRY RUN COMPLETE - NOTHING WAS INSERTED",
    );

    console.log(
      "==========================================",
    );

    console.log("");
    console.log(
      "Review the detected projects above.",
    );

    console.log(
      "If they are correct, run:",
    );

    console.log("");
    console.log(
      "npm run projects:backfill -- --apply",
    );

    await db.end();

    return;
  }

  console.log("");
  console.log(
    "Applying validated project candidates...",
  );

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    let insertedProjects = 0;
    let reusedProjects = 0;
    let memberAssignments = 0;
    let skippedNoGoal = 0;

    for (const candidate of sortedCandidates) {
      const goalId =
        chooseBestGoal(candidate);

      if (!goalId) {
        skippedNoGoal += 1;

        console.log(
          `SKIP: ${candidate.departmentName} -> ${candidate.name} has no goal.`,
        );

        continue;
      }

      /**
       * Double-check hierarchy.
       */
      const goalCheck =
        await client.query<{ id: string }>(
          `
          SELECT id
          FROM goals
          WHERE id = $1
            AND department_id = $2
            AND is_active = TRUE
          LIMIT 1
          `,
          [
            goalId,
            candidate.departmentId,
          ],
        );

      if (!goalCheck.rows[0]) {
        skippedNoGoal += 1;

        console.log(
          `SKIP: ${candidate.departmentName} -> ${candidate.name} goal/department mismatch.`,
        );

        continue;
      }

      /**
       * Historical status.
       *
       * Do not automatically CLOSED projects.
       */
      const status =
        candidate.totalActivities > 0 &&
        candidate.doneActivities ===
          candidate.totalActivities
          ? "DELIVERED"
          : "ACTIVE";

      const existing =
        await client.query<{ id: string }>(
          `
          SELECT id
          FROM projects
          WHERE department_id = $1
            AND LOWER(name) = LOWER($2)
          LIMIT 1
          `,
          [
            candidate.departmentId,
            candidate.name,
          ],
        );

      let projectId: string;

      if (existing.rows[0]) {
        projectId = existing.rows[0].id;
        reusedProjects += 1;
      } else {
        const inserted =
          await client.query<{ id: string }>(
            `
            INSERT INTO projects (
              department_id,
              goal_id,
              name,
              description,
              status,
              start_date,
              end_date
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6::date,
              $7::date
            )
            RETURNING id
            `,
            [
              candidate.departmentId,
              goalId,
              candidate.name,

              "Historical project reconstructed from validated STOP Management/Operation spreadsheet project references.",

              status,
              candidate.startDate,
              candidate.endDate,
            ],
          );

        projectId = inserted.rows[0].id;
        insertedProjects += 1;
      }

      /**
       * Attach everybody whose imported work
       * referenced this project.
       */
      for (const memberId of candidate.memberIds) {
        const membership =
          await client.query(
            `
            INSERT INTO project_members (
              project_id,
              member_id
            )

            VALUES ($1, $2)

            ON CONFLICT (
              project_id,
              member_id
            )

            DO NOTHING

            RETURNING member_id
            `,
            [
              projectId,
              memberId,
            ],
          );

        if (membership.rowCount) {
          memberAssignments += 1;
        }
      }
    }

    await client.query("COMMIT");

    console.log("");
    console.log(
      "==========================================",
    );

    console.log(
      "PROJECT BACKFILL COMPLETED SUCCESSFULLY",
    );

    console.log(
      "==========================================",
    );

    console.log(
      `New projects: ${insertedProjects}`,
    );

    console.log(
      `Existing projects reused: ${reusedProjects}`,
    );

    console.log(
      `Member assignments: ${memberAssignments}`,
    );

    console.log(
      `Skipped - no valid goal: ${skippedNoGoal}`,
    );
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("");
    console.error(
      "Backfill failed. Transaction rolled back.",
    );

    throw error;
  } finally {
    client.release();
    await db.end();
  }
}

run().catch((error) => {
  console.error("");
  console.error(
    "Project backfill failed:",
  );

  console.error(error);

  process.exitCode = 1;
});