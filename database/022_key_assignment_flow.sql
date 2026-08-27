-- Key -> Sub Goal -> Project -> Task -> Member -> Start Date -> End Date
--
-- A new, independent assignment flow. Entirely additive: no existing table,
-- column, or row is modified. The old Department -> Goal -> Action ->
-- Project -> Member -> Week Goal -> Daily Task hierarchy (goals, actions,
-- action_assignees, project_keys, week_plans, week_goals, tasks, task_actions)
-- is untouched and keeps working exactly as before.
--
-- Sub goals and the task master are intentionally seeded empty here. They are
-- populated later from source spreadsheets (STOP Operation sheet, Task sheet)
-- or created directly through the /keys and /tasks admin pages.

-- =========================================================
-- 1. ASSIGNMENT KEYS
-- Exactly three global, permanent keys. Titles are editable; the set of
-- three is fixed (no create/delete endpoint is exposed for this table).
-- =========================================================

CREATE TABLE IF NOT EXISTS assignment_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    code VARCHAR(10) NOT NULL
        CHECK (code IN ('KEY_A', 'KEY_B', 'KEY_C')),

    title VARCHAR(200) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_assignment_keys_code UNIQUE (code)
);

DROP TRIGGER IF EXISTS set_assignment_keys_updated_at ON assignment_keys;
CREATE TRIGGER set_assignment_keys_updated_at
BEFORE UPDATE ON assignment_keys
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO assignment_keys (code, title) VALUES
    ('KEY_A', 'KEY A'),
    ('KEY_B', 'KEY B'),
    ('KEY_C', 'KEY C')
ON CONFLICT (code) DO NOTHING;


-- =========================================================
-- 2. ASSIGNMENT SUB GOALS
-- Unlimited, editable sub goals per key. Soft-deleted via is_active so
-- historical assignments referencing a retired sub goal stay intact.
-- Seeded empty on purpose (see header note).
-- =========================================================

CREATE TABLE IF NOT EXISTS assignment_sub_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    key_id UUID NOT NULL
        REFERENCES assignment_keys(id),

    title VARCHAR(300) NOT NULL,
    description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_assignment_sub_goals_key_title
    ON assignment_sub_goals(key_id, LOWER(title));

CREATE INDEX IF NOT EXISTS idx_assignment_sub_goals_key
    ON assignment_sub_goals(key_id);

DROP TRIGGER IF EXISTS set_assignment_sub_goals_updated_at ON assignment_sub_goals;
CREATE TRIGGER set_assignment_sub_goals_updated_at
BEFORE UPDATE ON assignment_sub_goals
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =========================================================
-- 3. TASK MASTER
-- Independent task list. Never depends on project, key, or member. Soft
-- deleted via is_active; a hard delete is only allowed once a task is
-- inactive and unreferenced (enforced by the app layer and by the
-- ON DELETE RESTRICT foreign key from key_assignments below).
-- Seeded empty on purpose (see header note).
-- =========================================================

CREATE TABLE IF NOT EXISTS task_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    category VARCHAR(100) NOT NULL DEFAULT 'General',
    title VARCHAR(300) NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_task_master_category_title
    ON task_master(category, LOWER(title));

-- Keep reruns useful when this migration was applied before category became
-- optional in the manual Task Master flow.
ALTER TABLE task_master
    ALTER COLUMN category SET DEFAULT 'General';

CREATE INDEX IF NOT EXISTS idx_task_master_active
    ON task_master(is_active);

DROP TRIGGER IF EXISTS set_task_master_updated_at ON task_master;
CREATE TRIGGER set_task_master_updated_at
BEFORE UPDATE ON task_master
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =========================================================
-- 4. KEY ASSIGNMENTS
-- One record per submission: Key, Sub Goal, Project, Task, Member,
-- Start Date, End Date, Status. Department is intentionally NOT stored here
-- -- it is always read through project.department_id, so the project's
-- existing department mapping is the single source of truth.
-- =========================================================

CREATE TABLE IF NOT EXISTS key_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    key_id UUID NOT NULL
        REFERENCES assignment_keys(id),

    sub_goal_id UUID NOT NULL
        REFERENCES assignment_sub_goals(id),

    project_id UUID NOT NULL
        REFERENCES projects(id),

    task_id UUID NOT NULL
        REFERENCES task_master(id)
        ON DELETE RESTRICT,

    member_id UUID NOT NULL
        REFERENCES members(id),

    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

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

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_key_assignments_dates
        CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_key_assignments_member
    ON key_assignments(member_id, start_date DESC);

CREATE INDEX IF NOT EXISTS idx_key_assignments_project
    ON key_assignments(project_id);

CREATE INDEX IF NOT EXISTS idx_key_assignments_key
    ON key_assignments(key_id);

CREATE INDEX IF NOT EXISTS idx_key_assignments_sub_goal
    ON key_assignments(sub_goal_id);

CREATE INDEX IF NOT EXISTS idx_key_assignments_task
    ON key_assignments(task_id);

DROP TRIGGER IF EXISTS set_key_assignments_updated_at ON key_assignments;
CREATE TRIGGER set_key_assignments_updated_at
BEFORE UPDATE ON key_assignments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Enforce the hierarchy and active-record integrity the same way the rest
-- of this codebase does: a BEFORE INSERT/UPDATE trigger, not app-only checks
-- (see validate_project_key_department() in 017_project_keys.sql and
-- validate_active_planning_assignment() in 021_member_planning_flow.sql).
CREATE OR REPLACE FUNCTION validate_key_assignment()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM assignment_sub_goals sg
         WHERE sg.id = NEW.sub_goal_id
           AND sg.key_id = NEW.key_id
           AND sg.is_active
    ) THEN
        RAISE EXCEPTION 'The sub goal must be an active sub goal of the selected key.'
            USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM projects WHERE id = NEW.project_id AND is_active
    ) THEN
        RAISE EXCEPTION 'The selected project is not active.'
            USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM task_master WHERE id = NEW.task_id AND is_active
    ) THEN
        RAISE EXCEPTION 'The selected task is not active.'
            USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM members WHERE id = NEW.member_id AND is_active
    ) THEN
        RAISE EXCEPTION 'The selected member is not active.'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_key_assignment_before_write ON key_assignments;
CREATE TRIGGER validate_key_assignment_before_write
BEFORE INSERT OR UPDATE OF key_id, sub_goal_id, project_id, task_id, member_id
ON key_assignments
FOR EACH ROW EXECUTE FUNCTION validate_key_assignment();
