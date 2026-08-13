CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =========================================================
-- 1. DEPARTMENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(200) NOT NULL,
    description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    source_sheet VARCHAR(100),
    source_row INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 2. MEMBERS / EMPLOYEES
-- =========================================================

CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(200) NOT NULL,
    email VARCHAR(255),
    role_title VARCHAR(200),

    zoho_user_id VARCHAR(150),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    source_sheet VARCHAR(100),
    source_row INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 3. DEPARTMENT ↔ MEMBER
-- A member can belong to a department.
-- =========================================================

CREATE TABLE IF NOT EXISTS department_members (
    department_id UUID NOT NULL
        REFERENCES departments(id)
        ON DELETE CASCADE,

    member_id UUID NOT NULL
        REFERENCES members(id)
        ON DELETE CASCADE,

    is_department_head BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (department_id, member_id)
);


-- =========================================================
-- 4. GOALS / KEY OBJECTIVES
-- Example:
-- M1 Experienced MAN
-- Key Objective A - Workload & Quality Management
-- =========================================================

CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    department_id UUID NOT NULL
        REFERENCES departments(id)
        ON DELETE CASCADE,

    owner_member_id UUID
        REFERENCES members(id)
        ON DELETE SET NULL,

    parent_goal_id UUID
        REFERENCES goals(id)
        ON DELETE CASCADE,

    code VARCHAR(100),

    title TEXT NOT NULL,
    description TEXT,

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

    progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0
        CHECK (
            progress_percent >= 0
            AND progress_percent <= 100
        ),

    start_date DATE,
    end_date DATE,

    source_sheet VARCHAR(100),
    source_row INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 5. TARGETS / KPI
--
-- A goal can have MULTIPLE targets.
--
-- Example:
-- Goal: New MAN
-- Target 1: 12 leads / month
-- Target 2: 3 conversions / month
-- =========================================================

CREATE TABLE IF NOT EXISTS targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    goal_id UUID NOT NULL
        REFERENCES goals(id)
        ON DELETE CASCADE,

    title TEXT NOT NULL,

    target_value NUMERIC,
    target_unit VARCHAR(100),

    target_text TEXT,

    period_type VARCHAR(30)
        CHECK (
            period_type IS NULL
            OR period_type IN (
                'DAILY',
                'WEEKLY',
                'MONTHLY',
                'QUARTERLY',
                'YEARLY',
                'CUSTOM'
            )
        ),

    start_date DATE,
    end_date DATE,

    source_sheet VARCHAR(100),
    source_row INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 6. ACTIONS / SUB GOALS
--
-- Example:
-- M1-A Weekly MAN meeting
-- A1 Enhance Creative Concepts
-- =========================================================

CREATE TABLE IF NOT EXISTS actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    goal_id UUID NOT NULL
        REFERENCES goals(id)
        ON DELETE CASCADE,

    code VARCHAR(100),

    title TEXT NOT NULL,
    description TEXT,

    priority VARCHAR(20)
        CHECK (
            priority IS NULL
            OR priority IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

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

    progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0
        CHECK (
            progress_percent >= 0
            AND progress_percent <= 100
        ),

    start_date DATE,
    due_date DATE,

    source_sheet VARCHAR(100),
    source_row INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 7. ACTION ASSIGNEES
-- Multiple people can work on the same action.
-- =========================================================

CREATE TABLE IF NOT EXISTS action_assignees (
    action_id UUID NOT NULL
        REFERENCES actions(id)
        ON DELETE CASCADE,

    member_id UUID NOT NULL
        REFERENCES members(id)
        ON DELETE CASCADE,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (action_id, member_id)
);


-- =========================================================
-- 8. DAILY UPDATES
--
-- This replaces hundreds of date/status Excel columns.
--
-- 01-Apr-2025 | IQOO Composition | PROGRESS
-- becomes ONE database row.
-- =========================================================

CREATE TABLE IF NOT EXISTS daily_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    department_id UUID
        REFERENCES departments(id)
        ON DELETE SET NULL,

    member_id UUID NOT NULL
        REFERENCES members(id)
        ON DELETE CASCADE,

    goal_id UUID
        REFERENCES goals(id)
        ON DELETE SET NULL,

    action_id UUID
        REFERENCES actions(id)
        ON DELETE SET NULL,

    target_id UUID
        REFERENCES targets(id)
        ON DELETE SET NULL,

    update_date DATE NOT NULL,

    activity TEXT,

    status VARCHAR(30)
        CHECK (
            status IS NULL
            OR status IN (
                'NOT_STARTED',
                'IN_PROGRESS',
                'DONE',
                'ON_HOLD',
                'ABSENT',
                'LEAVE'
            )
        ),

    entry_type VARCHAR(30) NOT NULL DEFAULT 'WORK'
        CHECK (
            entry_type IN (
                'WORK',
                'MEETING',
                'LEAVE',
                'ATTENDANCE',
                'NOTE',
                'HOLIDAY'
            )
        ),

    progress_percent NUMERIC(5,2)
        CHECK (
            progress_percent IS NULL
            OR (
                progress_percent >= 0
                AND progress_percent <= 100
            )
        ),

    metric_value NUMERIC,

    note TEXT,

    source_sheet VARCHAR(100),
    source_row INTEGER,
    source_cell VARCHAR(30),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 9. TARGET MEASUREMENTS
--
-- Used for:
-- Target: 12 leads/month
-- Achieved: 9
-- Progress: 75%
-- =========================================================

CREATE TABLE IF NOT EXISTS target_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    target_id UUID NOT NULL
        REFERENCES targets(id)
        ON DELETE CASCADE,

    period_type VARCHAR(30) NOT NULL
        CHECK (
            period_type IN (
                'DAILY',
                'WEEKLY',
                'MONTHLY',
                'QUARTERLY',
                'YEARLY',
                'CUSTOM'
            )
        ),

    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    achieved_value NUMERIC,

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        target_id,
        period_type,
        period_start,
        period_end
    )
);


-- =========================================================
-- 10. PERIOD REVIEWS / EVALUATIONS
--
-- Used for historical spreadsheet monthly/quarterly/yearly
-- review text.
-- =========================================================

CREATE TABLE IF NOT EXISTS period_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    department_id UUID
        REFERENCES departments(id)
        ON DELETE SET NULL,

    member_id UUID
        REFERENCES members(id)
        ON DELETE SET NULL,

    goal_id UUID
        REFERENCES goals(id)
        ON DELETE SET NULL,

    period_type VARCHAR(30) NOT NULL
        CHECK (
            period_type IN (
                'WEEKLY',
                'MONTHLY',
                'QUARTERLY',
                'YEARLY',
                'CUSTOM'
            )
        ),

    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    score NUMERIC(5,2),

    summary TEXT,
    achievements TEXT,
    challenges TEXT,
    next_steps TEXT,

    source_sheet VARCHAR(100),
    source_row INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================================
-- 11. EXCEL IMPORT BATCH
--
-- Every Excel import gets its own batch.
-- =========================================================

CREATE TABLE IF NOT EXISTS import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    file_name VARCHAR(500) NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'STARTED'
        CHECK (
            status IN (
                'STARTED',
                'COMPLETED',
                'FAILED'
            )
        ),

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    notes TEXT
);


-- =========================================================
-- 12. RAW EXCEL ROW BACKUP
--
-- Before converting spreadsheet rows into goals/actions/etc,
-- save the raw row here.
-- =========================================================

CREATE TABLE IF NOT EXISTS excel_import_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    batch_id UUID NOT NULL
        REFERENCES import_batches(id)
        ON DELETE CASCADE,

    sheet_name VARCHAR(100) NOT NULL,
    row_number INTEGER NOT NULL,

    raw_data JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (batch_id, sheet_name, row_number)
);


-- =========================================================
-- 13. ZOHO MAPPINGS
--
-- We will use this AFTER the spreadsheet replacement works.
-- =========================================================

CREATE TABLE IF NOT EXISTS zoho_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    entity_type VARCHAR(50) NOT NULL,

    local_id UUID NOT NULL,

    zoho_entity_id VARCHAR(200),

    zoho_project_id VARCHAR(200),

    last_synced_at TIMESTAMPTZ,

    sync_status VARCHAR(30),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (entity_type, local_id)
);


-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_goals_department
    ON goals(department_id);

CREATE INDEX IF NOT EXISTS idx_goals_owner
    ON goals(owner_member_id);

CREATE INDEX IF NOT EXISTS idx_targets_goal
    ON targets(goal_id);

CREATE INDEX IF NOT EXISTS idx_actions_goal
    ON actions(goal_id);

CREATE INDEX IF NOT EXISTS idx_daily_updates_member_date
    ON daily_updates(member_id, update_date);

CREATE INDEX IF NOT EXISTS idx_daily_updates_department_date
    ON daily_updates(department_id, update_date);

CREATE INDEX IF NOT EXISTS idx_daily_updates_goal
    ON daily_updates(goal_id);

CREATE INDEX IF NOT EXISTS idx_daily_updates_action
    ON daily_updates(action_id);

CREATE INDEX IF NOT EXISTS idx_period_reviews_member
    ON period_reviews(member_id);

CREATE INDEX IF NOT EXISTS idx_target_measurements_target
    ON target_measurements(target_id);


-- =========================================================
-- EMAIL INDEX
-- =========================================================

CREATE UNIQUE INDEX IF NOT EXISTS ux_members_email
    ON members(LOWER(email))
    WHERE email IS NOT NULL;