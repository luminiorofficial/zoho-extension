-- Phase 1: Project -> Key -> Weekly Goal.
--
-- projects.goal_id remains unchanged for historical compatibility. New weekly
-- goals may instead use one of the project's mapped KEY_A / KEY_B / KEY_C
-- goals while retaining the existing action_id-based task hierarchy.

CREATE TABLE IF NOT EXISTS project_keys (
    project_id UUID NOT NULL
        REFERENCES projects(id)
        ON DELETE CASCADE,

    key_goal_id UUID NOT NULL
        REFERENCES goals(id)
        ON DELETE CASCADE,

    PRIMARY KEY (project_id, key_goal_id)
);

CREATE INDEX IF NOT EXISTS idx_project_keys_goal
    ON project_keys(key_goal_id);


-- A project can only be mapped to a goal in its own department. The key code
-- is intentionally not constrained here so later key renames do not break the
-- relationship; the client planning flow exposes the standard KEY_* codes.
CREATE OR REPLACE FUNCTION validate_project_key_department()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM projects p
          JOIN goals g
            ON g.id = NEW.key_goal_id
           AND g.department_id = p.department_id
         WHERE p.id = NEW.project_id
    ) THEN
        RAISE EXCEPTION 'Project keys must belong to the project department.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_project_key_department_before_write ON project_keys;
CREATE TRIGGER validate_project_key_department_before_write
BEFORE INSERT OR UPDATE OF project_id, key_goal_id ON project_keys
FOR EACH ROW EXECUTE FUNCTION validate_project_key_department();


-- Map every project to the active standard keys in the same department.
-- No project, goal, or historical planning row is changed by this backfill.
INSERT INTO project_keys (project_id, key_goal_id)
SELECT p.id, g.id
  FROM projects p
  JOIN goals g
    ON g.department_id = p.department_id
   AND g.is_active = TRUE
   AND UPPER(BTRIM(g.code)) IN ('KEY_A', 'KEY_B', 'KEY_C')
ON CONFLICT (project_id, key_goal_id) DO NOTHING;


-- Replace the legacy project+goal FK with project+department integrity. The
-- action+goal and action+member FKs remain in place, so action_id compatibility
-- is preserved while a mapped key may differ from projects.goal_id.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'uq_projects_id_department'
           AND conrelid = 'projects'::regclass
    ) THEN
        ALTER TABLE projects
            ADD CONSTRAINT uq_projects_id_department
            UNIQUE (id, department_id);
    END IF;
END
$$;

ALTER TABLE week_goals
    DROP CONSTRAINT IF EXISTS fk_week_goals_project_goal_department;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'fk_week_goals_project_department'
           AND conrelid = 'week_goals'::regclass
    ) THEN
        ALTER TABLE week_goals
            ADD CONSTRAINT fk_week_goals_project_department
            FOREIGN KEY (project_id, department_id)
            REFERENCES projects(id, department_id)
            ON DELETE CASCADE
            NOT VALID;
    END IF;
END
$$;

ALTER TABLE week_goals
    VALIDATE CONSTRAINT fk_week_goals_project_department;


-- Preserve the existing active-assignment checks. A weekly goal is compatible
-- when its goal is either the project's historical goal_id or a project key.
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
               AND (
                    p.goal_id = NEW.goal_id
                    OR EXISTS (
                        SELECT 1
                          FROM project_keys pk
                         WHERE pk.project_id = NEW.project_id
                           AND pk.key_goal_id = NEW.goal_id
                    )
               )
        ) THEN
            RAISE EXCEPTION 'Weekly goals require an active department, member, goal, action, and compatible project assignment.'
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
