-- Date-wise execution history for the existing Key -> Sub Goal -> Project ->
-- Task -> Member assignment hierarchy. This table is intentionally additive:
-- key_assignments remains the source of assignment structure and planned dates.

CREATE TABLE IF NOT EXISTS assignment_daily_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    assignment_id UUID NOT NULL
        REFERENCES key_assignments(id)
        ON DELETE CASCADE,

    work_date DATE NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED'
        CHECK (
            status IN (
                'NOT_STARTED',
                'IN_PROGRESS',
                'DONE',
                'ON_HOLD',
                'CANCELLED'
            )
        ),

    note TEXT,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_by UUID
        REFERENCES members(id)
        ON DELETE SET NULL,

    CONSTRAINT uq_assignment_daily_status_assignment_date
        UNIQUE (assignment_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_assignment_daily_status_work_date
    ON assignment_daily_status(work_date DESC);

CREATE INDEX IF NOT EXISTS idx_assignment_daily_status_assignment_date
    ON assignment_daily_status(assignment_id, work_date DESC);

DROP TRIGGER IF EXISTS set_assignment_daily_status_updated_at
    ON assignment_daily_status;
CREATE TRIGGER set_assignment_daily_status_updated_at
BEFORE UPDATE ON assignment_daily_status
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- key_assignments stores the assignment itself, not one copy per work date.
-- Historical imports (e.g. the STOP Operation sheet) recorded one
-- key_assignments row per work date for the same member/key/sub
-- goal/project/task, all sharing one source_row. Consolidate those
-- duplicate identities before enforcing the uniqueness invariant below.
--
-- Snapshot the dedup decision once so every later step (history migration,
-- deletion, date widening) agrees on the same keeper and range -- a plain
-- CTE would be recomputed, and the query planner is not guaranteed to
-- re-derive an identical row set once earlier statements start deleting rows.
CREATE TEMP TABLE key_assignment_dedup AS
WITH ranked_assignments AS (
    SELECT
        id,
        start_date AS own_start_date,
        end_date AS own_end_date,
        status AS own_status,
        FIRST_VALUE(id) OVER identity_window AS keeper_id,
        MIN(start_date) OVER identity_partition AS first_start_date,
        MAX(end_date) OVER identity_partition AS last_end_date,
        COUNT(*) OVER identity_partition AS duplicate_count
    FROM key_assignments
    WINDOW
        identity_partition AS (
            PARTITION BY member_id, key_id, sub_goal_id, project_id, task_id
        ),
        identity_window AS (
            PARTITION BY member_id, key_id, sub_goal_id, project_id, task_id
            ORDER BY updated_at DESC, created_at DESC, id
        )
)
SELECT id, own_start_date, own_end_date, own_status,
       keeper_id, first_start_date, last_end_date, duplicate_count
FROM ranked_assignments;

-- Backfill daily execution history from historical single-day duplicate
-- rows (start_date = end_date) before they are collapsed -- the old data
-- model recorded one key_assignments row per work date, with that date's
-- status on the row itself. Rows spanning more than one day carry no
-- unambiguous per-day status and are left alone (only their span is folded
-- into the widened range below). DO NOTHING here: an explicit daily record
-- already saved through the app is more authoritative than this backfill.
WITH ranked_backfill AS (
    SELECT
        keeper_id AS assignment_id,
        own_start_date AS work_date,
        own_status AS status,
        ROW_NUMBER() OVER (
            PARTITION BY keeper_id, own_start_date
            ORDER BY id
        ) AS date_rank
    FROM key_assignment_dedup
    WHERE duplicate_count > 1
      AND own_start_date = own_end_date
)
INSERT INTO assignment_daily_status (assignment_id, work_date, status)
SELECT assignment_id, work_date, status
FROM ranked_backfill
WHERE date_rank = 1
ON CONFLICT (assignment_id, work_date) DO NOTHING;

-- Move already-recorded execution history to the retained assignment before
-- its duplicate siblings are deleted. If duplicate assignments both have a
-- record for the same date, retain the most recently updated one; this
-- takes priority over the historical backfill above via DO UPDATE.
WITH ranked_daily_statuses AS (
    SELECT
        dedup.keeper_id AS assignment_id,
        daily.work_date,
        daily.status,
        daily.note,
        daily.updated_by,
        ROW_NUMBER() OVER (
            PARTITION BY dedup.keeper_id, daily.work_date
            ORDER BY daily.updated_at DESC, daily.id
        ) AS date_rank
    FROM assignment_daily_status daily
    JOIN key_assignment_dedup dedup ON dedup.id = daily.assignment_id
    WHERE dedup.duplicate_count > 1
)
INSERT INTO assignment_daily_status (
    assignment_id, work_date, status, note, updated_by
)
SELECT assignment_id, work_date, status, note, updated_by
FROM ranked_daily_statuses
WHERE date_rank = 1
ON CONFLICT (assignment_id, work_date)
DO UPDATE SET
    status = EXCLUDED.status,
    note = EXCLUDED.note,
    updated_by = EXCLUDED.updated_by;

-- Remove duplicate assignment rows now that their execution history has been
-- preserved on the retained assignment. This must happen before the date
-- widening below: duplicates sharing the keeper's import source_row still
-- hold the keeper's target start_date at this point, which would otherwise
-- collide with ux_key_assignments_import_source (024_key_assignment_import_
-- provenance.sql) once the keeper's date is widened onto it.
DELETE FROM key_assignments assignment
USING key_assignment_dedup dedup
WHERE assignment.id = dedup.id
  AND dedup.id <> dedup.keeper_id;

-- Widen the retained assignment's planned dates to cover the full window
-- the (now removed) duplicates spanned.
UPDATE key_assignments assignment
SET start_date = dedup.first_start_date,
    end_date = dedup.last_end_date
FROM key_assignment_dedup dedup
WHERE assignment.id = dedup.keeper_id
  AND dedup.duplicate_count > 1;

DROP TABLE key_assignment_dedup;

-- Every stored row is an active assignment; cancelled/completed state remains
-- an overall assignment status and does not create a second assignment row.
CREATE UNIQUE INDEX IF NOT EXISTS ux_key_assignments_assignment_identity
    ON key_assignments(member_id, key_id, sub_goal_id, project_id, task_id);
