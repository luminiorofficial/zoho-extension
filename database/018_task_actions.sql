-- Phase 2: Weekly Goal -> Task -> multiple task actions.
--
-- The existing actions table remains the structural Department -> Goal action
-- model used by historical planning and Zoho-linked workflows. Task actions are
-- intentionally separate records attached to canonical tasks.

ALTER TABLE tasks
    DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE tasks
    DROP CONSTRAINT IF EXISTS chk_tasks_status;

ALTER TABLE tasks
    ADD CONSTRAINT chk_tasks_status
    CHECK (status IN ('NOT_STARTED', 'STARTED', 'IN_PROGRESS', 'DONE'));


CREATE TABLE IF NOT EXISTS task_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    task_id UUID NOT NULL
        REFERENCES tasks(id)
        ON DELETE CASCADE,

    title TEXT NOT NULL
        CHECK (BTRIM(title) <> ''),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_actions_task
    ON task_actions(task_id, created_at, id);

DROP TRIGGER IF EXISTS set_task_actions_updated_at ON task_actions;
CREATE TRIGGER set_task_actions_updated_at
BEFORE UPDATE ON task_actions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- STARTED represents acknowledged/begun work and is scored at 25%. Existing
-- status scores and historical imported rows retain their previous meaning.
CREATE OR REPLACE VIEW week_goal_progress AS
SELECT
    wg.id AS week_goal_id,
    COUNT(t.id)::INTEGER AS total_tasks,
    COUNT(t.id) FILTER (WHERE t.status = 'DONE')::INTEGER AS done_tasks,
    COALESCE(
        ROUND(AVG(
            CASE t.status
                WHEN 'DONE' THEN 100
                WHEN 'IN_PROGRESS' THEN 50
                WHEN 'STARTED' THEN 25
                WHEN 'NOT_STARTED' THEN 0
            END
        ), 2),
        0
    ) AS progress_percent
FROM week_goals wg
LEFT JOIN tasks t ON t.week_goal_id = wg.id
GROUP BY wg.id;

CREATE OR REPLACE VIEW week_plan_progress AS
SELECT
    wp.id AS week_plan_id,
    COUNT(t.id)::INTEGER AS total_tasks,
    COUNT(t.id) FILTER (WHERE t.status = 'DONE')::INTEGER AS done_tasks,
    COALESCE(
        ROUND(AVG(
            CASE t.status
                WHEN 'DONE' THEN 100
                WHEN 'IN_PROGRESS' THEN 50
                WHEN 'STARTED' THEN 25
                WHEN 'NOT_STARTED' THEN 0
            END
        ), 2),
        0
    ) AS progress_percent
FROM week_plans wp
LEFT JOIN week_goals wg ON wg.week_plan_id = wp.id
LEFT JOIN tasks t ON t.week_goal_id = wg.id
GROUP BY wp.id;

CREATE OR REPLACE VIEW project_task_progress AS
SELECT
    project_id,
    COUNT(*)::INTEGER AS total_tasks,
    COUNT(*) FILTER (WHERE status = 'DONE')::INTEGER AS done_tasks,
    ROUND(AVG(
        CASE status
            WHEN 'DONE' THEN 100
            WHEN 'IN_PROGRESS' THEN 50
            WHEN 'STARTED' THEN 25
            WHEN 'NOT_STARTED' THEN 0
        END
    ), 2) AS progress_percent
FROM tasks
GROUP BY project_id;

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
            WHEN 'STARTED' THEN 25
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
