-- Live attendance and leave management.
-- Imported daily_updates stay untouched and are exposed through the
-- attendance_history view as read-only history.

-- =========================================================
-- 20. LEAVE REQUESTS
-- =========================================================

CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    department_id UUID NOT NULL,
    member_id UUID NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by_member_id UUID
        REFERENCES members(id) ON DELETE SET NULL,
    review_note TEXT,
    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_leave_request_membership
        FOREIGN KEY (department_id, member_id)
        REFERENCES department_members(department_id, member_id)
        ON DELETE CASCADE,
    CONSTRAINT chk_leave_request_dates
        CHECK (end_date >= start_date),
    CONSTRAINT chk_leave_request_review
        CHECK (
            (status = 'PENDING' AND reviewed_by_member_id IS NULL AND reviewed_at IS NULL)
            OR
            (status <> 'PENDING' AND reviewed_by_member_id IS NOT NULL AND reviewed_at IS NOT NULL)
        )
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_member_dates
    ON leave_requests(member_id, start_date DESC, end_date DESC);

CREATE INDEX IF NOT EXISTS idx_leave_requests_department_status
    ON leave_requests(department_id, status, start_date);


-- =========================================================
-- 21. LIVE ATTENDANCE
-- One editable row per member and date. Imported rows never enter this table.
-- =========================================================

CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL
        REFERENCES members(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL
        CHECK (status IN (
            'PRESENT',
            'HALF_DAY',
            'APPROVED_LEAVE',
            'ABSENT',
            'WORK_ON_HOLIDAY'
        )),
    note TEXT,
    source VARCHAR(30) NOT NULL DEFAULT 'MANUAL'
        CHECK (source IN ('MANUAL', 'LEAVE_REQUEST')),
    leave_request_id UUID
        REFERENCES leave_requests(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_attendance_member_date UNIQUE (member_id, attendance_date),
    CONSTRAINT chk_attendance_source
        CHECK (
            (source = 'MANUAL' AND leave_request_id IS NULL)
            OR
            (source = 'LEAVE_REQUEST' AND leave_request_id IS NOT NULL
                AND status = 'APPROVED_LEAVE')
        )
);

CREATE INDEX IF NOT EXISTS idx_attendance_date_status
    ON attendance_records(attendance_date, status);


-- An approved request materialises its date range as attendance. This keeps
-- the invariant true even when a request is reviewed outside the web route.
CREATE OR REPLACE FUNCTION sync_approved_leave_attendance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'APPROVED' AND (
        TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'APPROVED'
    ) THEN
        INSERT INTO attendance_records (
            member_id,
            attendance_date,
            status,
            note,
            source,
            leave_request_id
        )
        SELECT NEW.member_id,
               leave_date::date,
               'APPROVED_LEAVE',
               NEW.reason,
               'LEAVE_REQUEST',
               NEW.id
          FROM GENERATE_SERIES(
              NEW.start_date::timestamp,
              NEW.end_date::timestamp,
              INTERVAL '1 day'
          ) AS leave_date
        ON CONFLICT (member_id, attendance_date) DO UPDATE
            SET status = EXCLUDED.status,
                note = EXCLUDED.note,
                source = EXCLUDED.source,
                leave_request_id = EXCLUDED.leave_request_id,
                updated_at = NOW();
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.status = 'APPROVED'
       AND NEW.status IS DISTINCT FROM 'APPROVED' THEN
        DELETE FROM attendance_records
         WHERE leave_request_id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_approved_leave_attendance_after_change
    ON leave_requests;
CREATE TRIGGER sync_approved_leave_attendance_after_change
AFTER INSERT OR UPDATE OF status ON leave_requests
FOR EACH ROW EXECUTE FUNCTION sync_approved_leave_attendance();

DROP TRIGGER IF EXISTS set_leave_requests_updated_at ON leave_requests;
CREATE TRIGGER set_leave_requests_updated_at
BEFORE UPDATE ON leave_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_attendance_records_updated_at ON attendance_records;
CREATE TRIGGER set_attendance_records_updated_at
BEFORE UPDATE ON attendance_records
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =========================================================
-- UNIFIED ATTENDANCE HISTORY
-- Live rows win when a historical import and a live mark share a date.
-- Multiple imported work-tracking rows collapse to one attendance day.
-- =========================================================

CREATE OR REPLACE VIEW attendance_history AS
WITH imported_candidates AS (
    SELECT du.id,
           du.member_id,
           du.update_date AS attendance_date,
           CASE
               WHEN UPPER(COALESCE(du.activity, '') || ' ' || COALESCE(du.note, ''))
                    LIKE '%WORK ON HOLIDAY%' THEN 'WORK_ON_HOLIDAY'
               WHEN UPPER(COALESCE(du.activity, '') || ' ' || COALESCE(du.note, ''))
                    LIKE '%HALF DAY%' THEN 'HALF_DAY'
               WHEN du.status = 'ABSENT' THEN 'ABSENT'
               WHEN du.status = 'LEAVE' OR du.entry_type = 'LEAVE' THEN 'APPROVED_LEAVE'
               WHEN du.entry_type = 'ATTENDANCE' THEN 'PRESENT'
           END::VARCHAR(30) AS attendance_status,
           COALESCE(NULLIF(du.note, ''), NULLIF(du.activity, '')) AS note,
           ROW_NUMBER() OVER (
               PARTITION BY du.member_id, du.update_date
               ORDER BY
                   CASE
                       WHEN UPPER(COALESCE(du.activity, '') || ' ' || COALESCE(du.note, ''))
                            LIKE '%WORK ON HOLIDAY%' THEN 5
                       WHEN UPPER(COALESCE(du.activity, '') || ' ' || COALESCE(du.note, ''))
                            LIKE '%HALF DAY%' THEN 4
                       WHEN du.status = 'ABSENT' THEN 3
                       WHEN du.status = 'LEAVE' OR du.entry_type = 'LEAVE' THEN 2
                       ELSE 1
                   END DESC,
                   du.created_at,
                   du.id
           ) AS imported_rank
      FROM daily_updates du
     WHERE du.status IN ('ABSENT', 'LEAVE')
        OR du.entry_type IN ('ATTENDANCE', 'LEAVE')
        OR UPPER(COALESCE(du.activity, '') || ' ' || COALESCE(du.note, ''))
             LIKE '%HALF DAY%'
        OR UPPER(COALESCE(du.activity, '') || ' ' || COALESCE(du.note, ''))
             LIKE '%WORK ON HOLIDAY%'
), all_candidates AS (
    SELECT ar.id::text AS id,
           ar.member_id,
           ar.attendance_date,
           ar.status,
           ar.note,
           ar.source,
           FALSE AS is_read_only,
           ar.leave_request_id,
           2 AS source_priority
      FROM attendance_records ar

    UNION ALL

    SELECT 'daily-update:' || imported.id::text,
           imported.member_id,
           imported.attendance_date,
           imported.attendance_status,
           imported.note,
           'IMPORTED',
           TRUE,
           NULL::uuid,
           1
      FROM imported_candidates imported
     WHERE imported.imported_rank = 1
       AND imported.attendance_status IS NOT NULL
)
SELECT DISTINCT ON (member_id, attendance_date)
       id,
       member_id,
       attendance_date,
       status,
       note,
       source,
       is_read_only,
       leave_request_id
  FROM all_candidates
 ORDER BY member_id, attendance_date, source_priority DESC, id;
