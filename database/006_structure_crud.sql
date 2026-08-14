-- Non-destructive CRUD support for the imported organisation structure.
-- Rows are deactivated instead of being deleted so imported history and
-- downstream planning records keep their foreign-key relationships.

ALTER TABLE goals
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE targets
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE actions
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_goals_active_department
    ON goals(department_id, is_active);

CREATE INDEX IF NOT EXISTS idx_targets_active_goal
    ON targets(goal_id, is_active);

CREATE INDEX IF NOT EXISTS idx_actions_active_goal
    ON actions(goal_id, is_active);

DROP TRIGGER IF EXISTS set_departments_updated_at ON departments;
CREATE TRIGGER set_departments_updated_at
BEFORE UPDATE ON departments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_members_updated_at ON members;
CREATE TRIGGER set_members_updated_at
BEFORE UPDATE ON members
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_goals_updated_at ON goals;
CREATE TRIGGER set_goals_updated_at
BEFORE UPDATE ON goals
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_targets_updated_at ON targets;
CREATE TRIGGER set_targets_updated_at
BEFORE UPDATE ON targets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_actions_updated_at ON actions;
CREATE TRIGGER set_actions_updated_at
BEFORE UPDATE ON actions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
