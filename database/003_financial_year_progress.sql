-- Company financial periods run from April through March.
-- Q1 Apr-Jun, Q2 Jul-Sep, Q3 Oct-Dec, Q4 Jan-Mar.

CREATE OR REPLACE VIEW task_period_progress AS
WITH scored_tasks AS (
    SELECT
        p.department_id,
        t.assigned_member_id AS member_id,
        t.task_date,
        t.status,
        CASE t.status
            WHEN 'DONE' THEN 100
            WHEN 'IN_PROGRESS' THEN 50
            WHEN 'NOT_STARTED' THEN 0
        END AS score
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
), periods AS (
    SELECT
        department_id,
        member_id,
        task_date,
        status,
        score,
        'WEEKLY'::VARCHAR(30) AS period_type,
        DATE_TRUNC('week', task_date)::DATE AS period_start,
        (DATE_TRUNC('week', task_date)::DATE + 6) AS period_end
    FROM scored_tasks

    UNION ALL

    SELECT
        department_id,
        member_id,
        task_date,
        status,
        score,
        'MONTHLY'::VARCHAR(30),
        DATE_TRUNC('month', task_date)::DATE,
        (DATE_TRUNC('month', task_date) + INTERVAL '1 month - 1 day')::DATE
    FROM scored_tasks

    UNION ALL

    SELECT
        department_id,
        member_id,
        task_date,
        status,
        score,
        'QUARTERLY'::VARCHAR(30),
        (DATE_TRUNC('quarter', task_date - INTERVAL '3 months')
            + INTERVAL '3 months')::DATE,
        (DATE_TRUNC('quarter', task_date - INTERVAL '3 months')
            + INTERVAL '6 months - 1 day')::DATE
    FROM scored_tasks

    UNION ALL

    SELECT
        department_id,
        member_id,
        task_date,
        status,
        score,
        'YEARLY'::VARCHAR(30),
        (DATE_TRUNC('year', task_date - INTERVAL '3 months')
            + INTERVAL '3 months')::DATE,
        (DATE_TRUNC('year', task_date - INTERVAL '3 months')
            + INTERVAL '15 months - 1 day')::DATE
    FROM scored_tasks
)
SELECT
    department_id,
    member_id,
    period_type,
    period_start,
    period_end,
    COUNT(*)::INTEGER AS total_tasks,
    COUNT(*) FILTER (WHERE status = 'DONE')::INTEGER AS done_tasks,
    ROUND(AVG(score), 2) AS progress_percent
FROM periods
GROUP BY department_id, member_id, period_type, period_start, period_end;
