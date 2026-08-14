-- Imported Management and Operation updates are immutable source history.
-- Expose their recognised work statuses alongside editable tasks for progress
-- reporting without copying history into the tasks table.

CREATE INDEX IF NOT EXISTS idx_daily_updates_imported_progress
    ON daily_updates(update_date, department_id, member_id)
    WHERE source_sheet IN ('Management', 'Operation')
      AND status IN ('DONE', 'IN_PROGRESS', 'NOT_STARTED');

CREATE OR REPLACE VIEW work_progress_entries AS
    SELECT
        p.department_id,
        t.assigned_member_id AS member_id,
        wg.goal_id,
        t.action_id,
        t.id AS entry_id,
        t.task_date AS entry_date,
        t.status,
        CASE t.status
            WHEN 'DONE' THEN 100
            WHEN 'IN_PROGRESS' THEN 50
            WHEN 'NOT_STARTED' THEN 0
        END AS score
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    JOIN week_goals wg ON wg.id = t.week_goal_id

    UNION ALL

    SELECT
        COALESCE(du.department_id, g.department_id) AS department_id,
        du.member_id,
        COALESCE(du.goal_id, a.goal_id, target.goal_id) AS goal_id,
        du.action_id,
        du.id AS entry_id,
        du.update_date AS entry_date,
        du.status,
        CASE du.status
            WHEN 'DONE' THEN 100
            WHEN 'IN_PROGRESS' THEN 50
            WHEN 'NOT_STARTED' THEN 0
        END AS score
    FROM daily_updates du
    LEFT JOIN actions a ON a.id = du.action_id
    LEFT JOIN targets target ON target.id = du.target_id
    LEFT JOIN goals g ON g.id = COALESCE(du.goal_id, a.goal_id, target.goal_id)
    WHERE du.source_sheet IN ('Management', 'Operation')
      AND du.status IN ('DONE', 'IN_PROGRESS', 'NOT_STARTED');


CREATE OR REPLACE VIEW action_task_progress AS
SELECT
    action_id,
    COUNT(*)::integer AS total_tasks,
    COUNT(*) FILTER (WHERE status = 'DONE')::integer AS done_tasks,
    ROUND(AVG(score), 2) AS progress_percent
FROM work_progress_entries
WHERE action_id IS NOT NULL
GROUP BY action_id;


CREATE OR REPLACE VIEW goal_task_progress AS
SELECT
    goal_id,
    COUNT(*)::integer AS total_tasks,
    COUNT(*) FILTER (WHERE status = 'DONE')::integer AS done_tasks,
    ROUND(AVG(score), 2) AS progress_percent
FROM work_progress_entries
WHERE goal_id IS NOT NULL
GROUP BY goal_id;


CREATE OR REPLACE VIEW department_work_progress AS
SELECT
    department_id,
    COUNT(*)::integer AS total_tasks,
    COUNT(*) FILTER (WHERE status = 'DONE')::integer AS done_tasks,
    ROUND(AVG(score), 2) AS progress_percent
FROM work_progress_entries
WHERE department_id IS NOT NULL
GROUP BY department_id;


DROP VIEW IF EXISTS task_period_progress;
DROP VIEW IF EXISTS task_reporting_entries;

CREATE VIEW task_reporting_entries AS
WITH periods AS (
    SELECT work_progress_entries.*, 'WEEKLY'::varchar(30) AS period_type,
           DATE_TRUNC('week', entry_date)::date AS period_start,
           (DATE_TRUNC('week', entry_date)::date + 6) AS period_end
      FROM work_progress_entries
    UNION ALL
    SELECT work_progress_entries.*, 'MONTHLY'::varchar(30),
           DATE_TRUNC('month', entry_date)::date,
           (DATE_TRUNC('month', entry_date) + INTERVAL '1 month - 1 day')::date
      FROM work_progress_entries
    UNION ALL
    SELECT work_progress_entries.*, 'QUARTERLY'::varchar(30),
           (DATE_TRUNC('quarter', entry_date - INTERVAL '3 months') + INTERVAL '3 months')::date,
           (DATE_TRUNC('quarter', entry_date - INTERVAL '3 months') + INTERVAL '6 months - 1 day')::date
      FROM work_progress_entries
    UNION ALL
    SELECT work_progress_entries.*, 'YEARLY'::varchar(30),
           (DATE_TRUNC('year', entry_date - INTERVAL '3 months') + INTERVAL '3 months')::date,
           (DATE_TRUNC('year', entry_date - INTERVAL '3 months') + INTERVAL '15 months - 1 day')::date
      FROM work_progress_entries
)
SELECT
    department_id,
    member_id,
    goal_id,
    entry_id AS task_id,
    entry_date AS task_date,
    status,
    score,
    period_type,
    period_start,
    period_end
FROM periods;


CREATE VIEW task_period_progress AS
SELECT
    department_id,
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
