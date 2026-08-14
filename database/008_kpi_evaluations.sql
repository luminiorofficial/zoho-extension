-- KPI measurement and management reporting. Historical imported rows remain
-- untouched; new manual rows receive optional member attribution.

ALTER TABLE target_measurements
    ADD COLUMN IF NOT EXISTS member_id UUID
        REFERENCES members(id) ON DELETE SET NULL;

ALTER TABLE target_measurements
    DROP CONSTRAINT IF EXISTS target_measurements_target_id_period_type_period_start_period_key;
ALTER TABLE target_measurements
    DROP CONSTRAINT IF EXISTS target_measurements_target_id_period_type_period_start_peri_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_target_measurements_scope_period
    ON target_measurements (
        target_id,
        COALESCE(member_id, '00000000-0000-0000-0000-000000000000'::uuid),
        period_type,
        period_start,
        period_end
    );

CREATE INDEX IF NOT EXISTS idx_target_measurements_member_period
    ON target_measurements(member_id, period_type, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_period_reviews_scope_period
    ON period_reviews(department_id, member_id, goal_id, period_type, period_start DESC);

ALTER TABLE target_measurements
    DROP CONSTRAINT IF EXISTS chk_target_measurements_achieved_nonnegative;
ALTER TABLE target_measurements
    ADD CONSTRAINT chk_target_measurements_achieved_nonnegative
    CHECK (achieved_value IS NULL OR achieved_value >= 0) NOT VALID;

ALTER TABLE period_reviews
    DROP CONSTRAINT IF EXISTS chk_period_reviews_score_range;
ALTER TABLE period_reviews
    ADD CONSTRAINT chk_period_reviews_score_range
    CHECK (score IS NULL OR (score >= 0 AND score <= 100)) NOT VALID;

CREATE OR REPLACE FUNCTION validate_management_period()
RETURNS TRIGGER AS $$
DECLARE
    expected_start DATE;
    expected_end DATE;
BEGIN
    IF NEW.period_end < NEW.period_start THEN
        RAISE EXCEPTION 'Reporting period end cannot be before its start.'
            USING ERRCODE = '23514';
    END IF;

    IF NEW.period_type = 'WEEKLY' THEN
        expected_start := DATE_TRUNC('week', NEW.period_start)::date;
        expected_end := expected_start + 6;
    ELSIF NEW.period_type = 'MONTHLY' THEN
        expected_start := DATE_TRUNC('month', NEW.period_start)::date;
        expected_end := (DATE_TRUNC('month', NEW.period_start) + INTERVAL '1 month - 1 day')::date;
    ELSIF NEW.period_type = 'QUARTERLY' THEN
        expected_start := (DATE_TRUNC('quarter', NEW.period_start - INTERVAL '3 months') + INTERVAL '3 months')::date;
        expected_end := (DATE_TRUNC('quarter', NEW.period_start - INTERVAL '3 months') + INTERVAL '6 months - 1 day')::date;
    ELSIF NEW.period_type = 'YEARLY' THEN
        expected_start := (DATE_TRUNC('year', NEW.period_start - INTERVAL '3 months') + INTERVAL '3 months')::date;
        expected_end := (DATE_TRUNC('year', NEW.period_start - INTERVAL '3 months') + INTERVAL '15 months - 1 day')::date;
    ELSE
        RETURN NEW;
    END IF;

    IF NEW.period_start <> expected_start OR NEW.period_end <> expected_end THEN
        RAISE EXCEPTION 'Reporting period dates are not canonical for %.', NEW.period_type
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_target_measurement_period_before_write ON target_measurements;
CREATE TRIGGER validate_target_measurement_period_before_write
BEFORE INSERT OR UPDATE OF period_type, period_start, period_end ON target_measurements
FOR EACH ROW EXECUTE FUNCTION validate_management_period();

DROP TRIGGER IF EXISTS validate_period_review_period_before_write ON period_reviews;
CREATE TRIGGER validate_period_review_period_before_write
BEFORE INSERT OR UPDATE OF period_type, period_start, period_end ON period_reviews
FOR EACH ROW EXECUTE FUNCTION validate_management_period();

CREATE OR REPLACE FUNCTION validate_target_measurement_member()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.member_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
          FROM targets t
          JOIN goals g ON g.id = t.goal_id
          JOIN department_members dm
            ON dm.department_id = g.department_id
           AND dm.member_id = NEW.member_id
         WHERE t.id = NEW.target_id
    ) THEN
        RAISE EXCEPTION 'KPI member must belong to the target department.'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_target_measurement_member_before_write ON target_measurements;
CREATE TRIGGER validate_target_measurement_member_before_write
BEFORE INSERT OR UPDATE OF target_id, member_id ON target_measurements
FOR EACH ROW EXECUTE FUNCTION validate_target_measurement_member();

DROP VIEW IF EXISTS task_period_progress;
DROP VIEW IF EXISTS task_reporting_entries;

-- One canonical task-period scoring layer feeds both existing progress cards
-- and the new filtered reports.
CREATE VIEW task_reporting_entries AS
WITH scored_tasks AS (
    SELECT
        p.department_id,
        t.assigned_member_id AS member_id,
        wg.goal_id,
        t.id AS task_id,
        t.task_date,
        t.status,
        CASE t.status
            WHEN 'DONE' THEN 100
            WHEN 'IN_PROGRESS' THEN 50
            WHEN 'NOT_STARTED' THEN 0
        END AS score
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    JOIN week_goals wg ON wg.id = t.week_goal_id
), periods AS (
    SELECT scored_tasks.*, 'WEEKLY'::varchar(30) AS period_type,
           DATE_TRUNC('week', task_date)::date AS period_start,
           (DATE_TRUNC('week', task_date)::date + 6) AS period_end
      FROM scored_tasks
    UNION ALL
    SELECT scored_tasks.*, 'MONTHLY'::varchar(30),
           DATE_TRUNC('month', task_date)::date,
           (DATE_TRUNC('month', task_date) + INTERVAL '1 month - 1 day')::date
      FROM scored_tasks
    UNION ALL
    SELECT scored_tasks.*, 'QUARTERLY'::varchar(30),
           (DATE_TRUNC('quarter', task_date - INTERVAL '3 months') + INTERVAL '3 months')::date,
           (DATE_TRUNC('quarter', task_date - INTERVAL '3 months') + INTERVAL '6 months - 1 day')::date
      FROM scored_tasks
    UNION ALL
    SELECT scored_tasks.*, 'YEARLY'::varchar(30),
           (DATE_TRUNC('year', task_date - INTERVAL '3 months') + INTERVAL '3 months')::date,
           (DATE_TRUNC('year', task_date - INTERVAL '3 months') + INTERVAL '15 months - 1 day')::date
      FROM scored_tasks
)
SELECT * FROM periods;

CREATE VIEW task_period_progress AS
SELECT department_id,
       member_id,
       period_type,
       period_start,
       period_end,
       COUNT(*)::integer AS total_tasks,
       COUNT(*) FILTER (WHERE status = 'DONE')::integer AS done_tasks,
       ROUND(AVG(score), 2) AS progress_percent,
       goal_id
  FROM task_reporting_entries
 GROUP BY department_id, member_id, goal_id, period_type, period_start, period_end;

CREATE OR REPLACE VIEW target_measurement_progress AS
SELECT tm.id,
       tm.target_id,
       tm.member_id,
       tm.period_type,
       tm.period_start,
       tm.period_end,
       tm.achieved_value,
       tm.note,
       CASE
           WHEN t.target_value > 0 AND tm.achieved_value IS NOT NULL
           THEN ROUND((tm.achieved_value / t.target_value) * 100, 2)
           ELSE NULL
       END AS progress_percent,
       tm.created_at,
       tm.updated_at
  FROM target_measurements tm
  JOIN targets t ON t.id = tm.target_id;

DROP TRIGGER IF EXISTS set_target_measurements_updated_at ON target_measurements;
CREATE TRIGGER set_target_measurements_updated_at
BEFORE UPDATE ON target_measurements
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_period_reviews_updated_at ON period_reviews;
CREATE TRIGGER set_period_reviews_updated_at
BEFORE UPDATE ON period_reviews
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
