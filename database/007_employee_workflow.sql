-- Complete the employee planning workflow without introducing parallel models.
-- Existing imported daily_updates remain untouched and read-only through
-- attendance_history.

-- Track carry-forward lineage on the canonical tasks table so the same task
-- cannot be copied into the following week more than once.
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS carried_from_task_id UUID
        REFERENCES tasks(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_tasks_carried_from_once
    ON tasks(carried_from_task_id)
    WHERE carried_from_task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_carried_from
    ON tasks(carried_from_task_id);


-- Goal progress uses the same task scoring as week goals, actions, and projects.
CREATE OR REPLACE VIEW goal_task_progress AS
SELECT
    wg.goal_id,
    COUNT(t.id)::INTEGER AS total_tasks,
    COUNT(t.id) FILTER (WHERE t.status = 'DONE')::INTEGER AS done_tasks,
    ROUND(AVG(
        CASE t.status
            WHEN 'DONE' THEN 100
            WHEN 'IN_PROGRESS' THEN 50
            WHEN 'NOT_STARTED' THEN 0
        END
    ), 2) AS progress_percent
FROM week_goals wg
JOIN tasks t ON t.week_goal_id = wg.id
GROUP BY wg.goal_id;


-- Enforce active, compatible planning assignments at the database boundary.
-- Updates that only change task status/content or weekly-goal content are still
-- allowed, preserving existing plans after later structure deactivation.
CREATE OR REPLACE FUNCTION validate_active_planning_assignment()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'week_plans' THEN
        IF NOT EXISTS (
            SELECT 1
              FROM departments d
              JOIN department_members dm ON dm.department_id = d.id
              JOIN members m ON m.id = dm.member_id
             WHERE d.id = NEW.department_id
               AND dm.member_id = NEW.member_id
               AND d.is_active
               AND m.is_active
        ) THEN
            RAISE EXCEPTION 'Weekly plans require an active department member.'
                USING ERRCODE = '23514';
        END IF;

        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'week_goals' THEN
        IF NOT EXISTS (
            SELECT 1
              FROM week_plans wp
              JOIN departments d ON d.id = NEW.department_id
              JOIN members m ON m.id = NEW.assigned_member_id
              JOIN goals g
                ON g.id = NEW.goal_id
               AND g.department_id = NEW.department_id
              JOIN actions a
                ON a.id = NEW.action_id
               AND a.goal_id = NEW.goal_id
              JOIN action_assignees aa
                ON aa.action_id = NEW.action_id
               AND aa.member_id = NEW.assigned_member_id
              JOIN projects p
                ON p.id = NEW.project_id
               AND p.goal_id = NEW.goal_id
               AND p.department_id = NEW.department_id
              JOIN project_members pm
                ON pm.project_id = NEW.project_id
               AND pm.member_id = NEW.assigned_member_id
             WHERE wp.id = NEW.week_plan_id
               AND wp.department_id = NEW.department_id
               AND wp.member_id = NEW.assigned_member_id
               AND wp.week_start = NEW.week_start
               AND d.is_active
               AND m.is_active
               AND g.is_active
               AND a.is_active
               AND p.status IN ('PLANNED', 'ACTIVE', 'INTERNAL_REVIEW', 'CLIENT_REVIEW')
        ) THEN
            RAISE EXCEPTION 'Weekly goals require an active department, member, goal, action, and project assignment.'
                USING ERRCODE = '23514';
        END IF;

        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'tasks' THEN
        IF NEW.task_date < NEW.week_start OR NEW.task_date > NEW.week_start + 4 THEN
            RAISE EXCEPTION 'Daily tasks must be scheduled Monday through Friday.'
                USING ERRCODE = '23514';
        END IF;

        IF NOT EXISTS (
            SELECT 1
              FROM week_goals wg
              JOIN departments d ON d.id = wg.department_id
              JOIN members m ON m.id = wg.assigned_member_id
              JOIN goals g ON g.id = wg.goal_id
              JOIN actions a ON a.id = wg.action_id
              JOIN projects p ON p.id = wg.project_id
              JOIN action_assignees aa
                ON aa.action_id = wg.action_id
               AND aa.member_id = wg.assigned_member_id
              JOIN project_members pm
                ON pm.project_id = wg.project_id
               AND pm.member_id = wg.assigned_member_id
             WHERE wg.id = NEW.week_goal_id
               AND wg.action_id = NEW.action_id
               AND wg.project_id = NEW.project_id
               AND wg.assigned_member_id = NEW.assigned_member_id
               AND wg.week_start = NEW.week_start
               AND d.is_active
               AND m.is_active
               AND g.is_active
               AND a.is_active
               AND p.status IN ('PLANNED', 'ACTIVE', 'INTERNAL_REVIEW', 'CLIENT_REVIEW')
        ) THEN
            RAISE EXCEPTION 'Daily tasks require an active weekly-goal hierarchy.'
                USING ERRCODE = '23514';
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_active_week_plan_before_assignment ON week_plans;
CREATE TRIGGER validate_active_week_plan_before_assignment
BEFORE INSERT OR UPDATE OF department_id, member_id, week_start ON week_plans
FOR EACH ROW EXECUTE FUNCTION validate_active_planning_assignment();

DROP TRIGGER IF EXISTS validate_active_week_goal_before_assignment ON week_goals;
CREATE TRIGGER validate_active_week_goal_before_assignment
BEFORE INSERT OR UPDATE OF
    week_plan_id, department_id, assigned_member_id, goal_id,
    action_id, project_id, week_start
ON week_goals
FOR EACH ROW EXECUTE FUNCTION validate_active_planning_assignment();

DROP TRIGGER IF EXISTS validate_active_task_before_assignment ON tasks;
CREATE TRIGGER validate_active_task_before_assignment
BEFORE INSERT OR UPDATE OF
    week_goal_id, action_id, project_id, assigned_member_id, week_start, task_date
ON tasks
FOR EACH ROW EXECUTE FUNCTION validate_active_planning_assignment();
