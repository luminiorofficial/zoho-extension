-- Member planning starts from any active project and creates assignments on use.
-- Keep legacy action_id columns so historical goals and tasks remain intact.

INSERT INTO project_keys (project_id, key_goal_id)
SELECT p.id, g.id
    FROM projects p
    JOIN goals g ON g.department_id = p.department_id
 WHERE g.is_active
     AND UPPER(BTRIM(g.code)) IN ('KEY_A', 'KEY_B', 'KEY_C')
ON CONFLICT DO NOTHING;

ALTER TABLE week_goals
    DROP CONSTRAINT IF EXISTS fk_week_goals_action_assignee;

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
               AND d.is_active AND m.is_active
        ) THEN
            RAISE EXCEPTION 'Weekly plans require an active department member.' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'week_goals' THEN
        IF NOT EXISTS (
            SELECT 1
              FROM week_plans wp
              JOIN departments d ON d.id = NEW.department_id
              JOIN members m ON m.id = NEW.assigned_member_id
              JOIN goals g ON g.id = NEW.goal_id
               AND g.department_id = NEW.department_id
              JOIN actions a ON a.id = NEW.action_id
               AND a.goal_id = NEW.goal_id
              JOIN projects p ON p.id = NEW.project_id
               AND p.department_id = NEW.department_id
             WHERE wp.id = NEW.week_plan_id
               AND wp.department_id = NEW.department_id
               AND wp.member_id = NEW.assigned_member_id
               AND wp.week_start = NEW.week_start
               AND d.is_active AND m.is_active AND g.is_active AND a.is_active
               AND p.is_active
               AND p.status IN ('PLANNED', 'ACTIVE', 'INTERNAL_REVIEW', 'CLIENT_REVIEW')
               AND (p.goal_id = NEW.goal_id OR EXISTS (
                   SELECT 1 FROM project_keys pk
                    WHERE pk.project_id = NEW.project_id
                      AND pk.key_goal_id = NEW.goal_id
               ))
        ) THEN
            RAISE EXCEPTION 'Weekly goals require an active compatible project and key.' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;

    IF TG_TABLE_NAME = 'tasks' THEN
        IF NEW.task_date < NEW.week_start OR NEW.task_date > NEW.week_start + 4 THEN
            RAISE EXCEPTION 'Daily tasks must be scheduled Monday through Friday.' USING ERRCODE = '23514';
        END IF;

        IF NOT EXISTS (
            SELECT 1
              FROM week_goals wg
              JOIN departments d ON d.id = wg.department_id
              JOIN members m ON m.id = wg.assigned_member_id
              JOIN goals g ON g.id = wg.goal_id
              JOIN actions a ON a.id = wg.action_id
              JOIN projects p ON p.id = wg.project_id
             WHERE wg.id = NEW.week_goal_id
               AND wg.action_id = NEW.action_id
               AND wg.project_id = NEW.project_id
               AND wg.assigned_member_id = NEW.assigned_member_id
               AND wg.week_start = NEW.week_start
               AND d.is_active AND m.is_active AND g.is_active AND a.is_active
               AND p.is_active
               AND p.status IN ('PLANNED', 'ACTIVE', 'INTERNAL_REVIEW', 'CLIENT_REVIEW')
        ) THEN
            RAISE EXCEPTION 'Daily tasks require an active weekly-goal hierarchy.' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;