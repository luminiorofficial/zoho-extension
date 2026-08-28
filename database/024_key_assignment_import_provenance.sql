-- STOP historical import provenance + idempotency.
--
-- key_assignments rows created by scripts/map-stop-historical-assignments.ts
-- record exactly which STOP workbook cell they came from, using the same
-- source_sheet/source_row/source_cell provenance columns already used for
-- departments, members, goals, actions, and daily_updates imports (see
-- 009_excel_migration_provenance.sql). Manually created assignments (via the
-- /keys admin UI) leave these columns NULL and are unaffected by the
-- constraint below -- NULL source_sheet/source_row never match the partial
-- index's WHERE clause, so manual rows can repeat freely.
--
-- A given STOP source cell always resolves to the same (start_date, member,
-- project, task) once matching data is stable, so a partial unique index on
-- that full combination lets the importer use ON CONFLICT ... DO NOTHING to
-- guarantee reruns never insert a duplicate row for the same source cell.

ALTER TABLE key_assignments
    ADD COLUMN IF NOT EXISTS source_sheet VARCHAR(100);

ALTER TABLE key_assignments
    ADD COLUMN IF NOT EXISTS source_row INTEGER;

ALTER TABLE key_assignments
    ADD COLUMN IF NOT EXISTS source_cell VARCHAR(30);

ALTER TABLE key_assignments
    ADD COLUMN IF NOT EXISTS source_activity TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_key_assignments_import_source
    ON key_assignments(source_sheet, source_row, start_date, member_id, project_id, task_id)
    WHERE source_sheet IN ('Management', 'Operation') AND source_row IS NOT NULL;
