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
