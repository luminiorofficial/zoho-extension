-- Department -> Goal -> Action -> Member -> Week Goal -> Daily Task
--
-- `daily_updates` remains the historical/import activity log. `tasks` is the
-- canonical, editable daily work record introduced by this milestone.

-- Composite keys below let PostgreSQL enforce the hierarchy without relying
-- only on application-side validation.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'uq_goals_id_department'
           AND conrelid = 'goals'::regclass
    ) THEN
        ALTER TABLE goals
            ADD CONSTRAINT uq_goals_id_department UNIQUE (id, department_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'uq_actions_id_goal'
           AND conrelid = 'actions'::regclass
    ) THEN
        ALTER TABLE actions
            ADD CONSTRAINT uq_actions_id_goal UNIQUE (id, goal_id);
    END IF;
END
$$;


-- =========================================================
-- 14. PROJECTS
-- A project belongs to one department goal and groups executable tasks.
-- =========================================================

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    department_id UUID NOT NULL,
    goal_id UUID NOT NULL,

    code VARCHAR(100),
    name VARCHAR(250) NOT NULL,
    description TEXT,

    status VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED'
        CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'DONE')),

    start_date DATE,
    end_date DATE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_projects_goal_department
        FOREIGN KEY (goal_id, department_id)
        REFERENCES goals(id, department_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_projects_dates
        CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),

    CONSTRAINT uq_projects_id_goal_department
        UNIQUE (id, goal_id, department_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_projects_department_name
    ON projects(department_id, LOWER(name));

CREATE INDEX IF NOT EXISTS idx_projects_goal
    ON projects(goal_id);


-- =========================================================
-- 15. WEEK PLANS
-- One member has one plan per department and ISO week.
-- =========================================================

CREATE TABLE IF NOT EXISTS week_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    department_id UUID NOT NULL,
    member_id UUID NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE GENERATED ALWAYS AS (week_start + 6) STORED,

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_week_plans_membership
        FOREIGN KEY (department_id, member_id)
        REFERENCES department_members(department_id, member_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_week_plans_start_monday
        CHECK (EXTRACT(ISODOW FROM week_start) = 1),

    CONSTRAINT uq_week_plans_member_week
        UNIQUE (department_id, member_id, week_start),

    CONSTRAINT uq_week_plans_hierarchy
        UNIQUE (id, department_id, member_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_week_plans_member_week
    ON week_plans(member_id, week_start DESC);


-- =========================================================
-- 16. WEEK GOALS
-- A weekly commitment for one assigned member, action, and project.
-- =========================================================

CREATE TABLE IF NOT EXISTS week_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    week_plan_id UUID NOT NULL,
    department_id UUID NOT NULL,
    assigned_member_id UUID NOT NULL,
    goal_id UUID NOT NULL,
    action_id UUID NOT NULL,
    project_id UUID NOT NULL,
    week_start DATE NOT NULL,

    title TEXT NOT NULL,
    description TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_week_goals_plan
        FOREIGN KEY (week_plan_id, department_id, assigned_member_id, week_start)
        REFERENCES week_plans(id, department_id, member_id, week_start)
        ON DELETE CASCADE,

    CONSTRAINT fk_week_goals_action_goal
        FOREIGN KEY (action_id, goal_id)
        REFERENCES actions(id, goal_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_week_goals_project_goal_department
        FOREIGN KEY (project_id, goal_id, department_id)
        REFERENCES projects(id, goal_id, department_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_week_goals_action_assignee
        FOREIGN KEY (action_id, assigned_member_id)
        REFERENCES action_assignees(action_id, member_id)
        ON DELETE CASCADE,

    CONSTRAINT uq_week_goals_commitment
        UNIQUE (week_plan_id, action_id, project_id, title),

    CONSTRAINT uq_week_goals_task_hierarchy
        UNIQUE (id, action_id, project_id, assigned_member_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_week_goals_member_week
    ON week_goals(assigned_member_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_week_goals_action
    ON week_goals(action_id);

CREATE INDEX IF NOT EXISTS idx_week_goals_project
    ON week_goals(project_id);


-- =========================================================
-- 17. TASKS
-- Editable daily work. Every row is tied to the exact weekly commitment.
-- =========================================================

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    week_goal_id UUID NOT NULL,
    action_id UUID NOT NULL,
    project_id UUID NOT NULL,
    assigned_member_id UUID NOT NULL,
    week_start DATE NOT NULL,

    title TEXT NOT NULL,
    description TEXT,
    task_date DATE NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED'
        CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'DONE')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_tasks_week_goal_hierarchy
        FOREIGN KEY (
            week_goal_id,
            action_id,
            project_id,
            assigned_member_id,
            week_start
        )
        REFERENCES week_goals(
            id,
            action_id,
            project_id,
            assigned_member_id,
            week_start
        )
        ON DELETE CASCADE,

    CONSTRAINT chk_tasks_date_in_week
        CHECK (task_date >= week_start AND task_date <= week_start + 6)
);

CREATE INDEX IF NOT EXISTS idx_tasks_member_date
    ON tasks(assigned_member_id, task_date DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_project_date
    ON tasks(project_id, task_date DESC);

CREATE INDEX IF NOT EXISTS idx_tasks_action
    ON tasks(action_id);

CREATE INDEX IF NOT EXISTS idx_tasks_week_goal
    ON tasks(week_goal_id);


-- =========================================================
-- AUTOMATIC PROGRESS VIEWS
-- Not Started = 0, In Progress = 50, Done = 100.
-- Period rollups are task-weighted so a monthly/quarterly/yearly figure is
-- always derived from its daily tasks, including weeks crossing boundaries.
-- =========================================================

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
                WHEN 'NOT_STARTED' THEN 0
            END
        ), 2),
        0
    ) AS progress_percent
FROM week_plans wp
LEFT JOIN week_goals wg ON wg.week_plan_id = wp.id
LEFT JOIN tasks t ON t.week_goal_id = wg.id
GROUP BY wp.id;

CREATE OR REPLACE VIEW action_task_progress AS
SELECT
    action_id,
    COUNT(*)::INTEGER AS total_tasks,
    COUNT(*) FILTER (WHERE status = 'DONE')::INTEGER AS done_tasks,
    ROUND(AVG(
        CASE status
            WHEN 'DONE' THEN 100
            WHEN 'IN_PROGRESS' THEN 50
            WHEN 'NOT_STARTED' THEN 0
        END
    ), 2) AS progress_percent
FROM tasks
GROUP BY action_id;

CREATE OR REPLACE VIEW project_task_progress AS
SELECT
    project_id,
    COUNT(*)::INTEGER AS total_tasks,
    COUNT(*) FILTER (WHERE status = 'DONE')::INTEGER AS done_tasks,
    ROUND(AVG(
        CASE status
            WHEN 'DONE' THEN 100
            WHEN 'IN_PROGRESS' THEN 50
            WHEN 'NOT_STARTED' THEN 0
        END
    ), 2) AS progress_percent
FROM tasks
GROUP BY project_id;

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
        DATE_TRUNC('quarter', task_date)::DATE,
        (DATE_TRUNC('quarter', task_date) + INTERVAL '3 months - 1 day')::DATE
    FROM scored_tasks

    UNION ALL

    SELECT
        department_id,
        member_id,
        task_date,
        status,
        score,
        'YEARLY'::VARCHAR(30),
        DATE_TRUNC('year', task_date)::DATE,
        (DATE_TRUNC('year', task_date) + INTERVAL '1 year - 1 day')::DATE
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


-- Keep mutation timestamps consistent for the new planning tables.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_projects_updated_at ON projects;
CREATE TRIGGER set_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_week_plans_updated_at ON week_plans;
CREATE TRIGGER set_week_plans_updated_at
BEFORE UPDATE ON week_plans
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_week_goals_updated_at ON week_goals;
CREATE TRIGGER set_week_goals_updated_at
BEFORE UPDATE ON week_goals
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_tasks_updated_at ON tasks;
CREATE TRIGGER set_tasks_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
