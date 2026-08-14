-- Complete cell-level Excel provenance without changing existing business data.
-- Department summary rows can contain valid activity updates before any member
-- row appears, so imported daily updates may be scoped to a department only.

ALTER TABLE departments
    ADD COLUMN IF NOT EXISTS source_cell VARCHAR(30);

ALTER TABLE members
    ADD COLUMN IF NOT EXISTS source_cell VARCHAR(30);

ALTER TABLE goals
    ADD COLUMN IF NOT EXISTS source_cell VARCHAR(30);

ALTER TABLE targets
    ADD COLUMN IF NOT EXISTS source_cell VARCHAR(30);

ALTER TABLE actions
    ADD COLUMN IF NOT EXISTS source_cell VARCHAR(30);

ALTER TABLE daily_updates
    ALTER COLUMN member_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_departments_import_source
    ON departments(source_sheet, source_row)
    WHERE source_sheet IS NOT NULL AND source_row IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_members_import_source
    ON members(source_sheet, source_row)
    WHERE source_sheet IS NOT NULL AND source_row IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_goals_import_source
    ON goals(source_sheet, source_row)
    WHERE source_sheet IS NOT NULL AND source_row IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_targets_import_source
    ON targets(source_sheet, source_row, goal_id)
    WHERE source_sheet IS NOT NULL AND source_row IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_actions_import_source
    ON actions(source_sheet, source_row)
    WHERE source_sheet IS NOT NULL AND source_row IS NOT NULL;

DROP INDEX IF EXISTS ux_daily_updates_import_source;
CREATE UNIQUE INDEX ux_daily_updates_import_source
    ON daily_updates(source_sheet, source_row, update_date)
    WHERE source_sheet IN ('Management', 'Operation') AND source_row IS NOT NULL;
