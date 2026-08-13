-- Project management and job closure.
-- Reuses the existing projects table and task-derived project progress view.

-- Replace the original planning status set with the delivery workflow.
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_budget_check;

UPDATE projects
   SET status = CASE status
       WHEN 'NOT_STARTED' THEN 'PLANNED'
       WHEN 'IN_PROGRESS' THEN 'ACTIVE'
       WHEN 'DONE' THEN 'DELIVERED'
       ELSE status
   END;

ALTER TABLE projects
    ALTER COLUMN status SET DEFAULT 'PLANNED',
    ADD COLUMN IF NOT EXISTS client_name VARCHAR(250),
    ADD COLUMN IF NOT EXISTS owner_member_id UUID
        REFERENCES members(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS budget NUMERIC(14,2);

ALTER TABLE projects
    ADD CONSTRAINT projects_status_check
        CHECK (status IN (
            'PLANNED',
            'ACTIVE',
            'INTERNAL_REVIEW',
            'CLIENT_REVIEW',
            'DELIVERED',
            'CLOSURE_PENDING',
            'CLOSED'
        )),
    ADD CONSTRAINT projects_budget_check
        CHECK (budget IS NULL OR budget >= 0);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_member_id);


-- =========================================================
-- 18. PROJECT MEMBERS
-- Explicit staffing for project filters, details, and closure assignment.
-- =========================================================

CREATE TABLE IF NOT EXISTS project_members (
    project_id UUID NOT NULL
        REFERENCES projects(id) ON DELETE CASCADE,
    member_id UUID NOT NULL
        REFERENCES members(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (project_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_member
    ON project_members(member_id);

-- Preserve assignments already represented by weekly goals.
INSERT INTO project_members (project_id, member_id)
SELECT DISTINCT project_id, assigned_member_id
  FROM week_goals
ON CONFLICT DO NOTHING;

INSERT INTO project_members (project_id, member_id)
SELECT id, owner_member_id
  FROM projects
 WHERE owner_member_id IS NOT NULL
ON CONFLICT DO NOTHING;


-- =========================================================
-- 19. PROJECT CLOSURE CHECKLIST
-- One required row for each standard closure deliverable.
-- =========================================================

CREATE TABLE IF NOT EXISTS project_closure_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL
        REFERENCES projects(id) ON DELETE CASCADE,
    item_key VARCHAR(60) NOT NULL
        CHECK (item_key IN (
            'FINAL_FORMATS_CHECKED',
            'DRIVE_CLOSURE_COMPLETED',
            'PORTFOLIO_GIF_CREATED',
            'PROJECT_PPT_COMPLETED',
            'PORTFOLIO_UPDATE_COMPLETED',
            'INVOICE_ACCOUNTS_NOTIFIED'
        )),
    assigned_member_id UUID
        REFERENCES members(id) ON DELETE SET NULL,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, item_key),
    CONSTRAINT chk_closure_completed_at
        CHECK (
            (is_completed AND completed_at IS NOT NULL)
            OR (NOT is_completed AND completed_at IS NULL)
        )
);

CREATE INDEX IF NOT EXISTS idx_project_closure_project
    ON project_closure_items(project_id);

CREATE INDEX IF NOT EXISTS idx_project_closure_assignee
    ON project_closure_items(assigned_member_id);

CREATE OR REPLACE FUNCTION add_project_closure_items()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO project_closure_items (project_id, item_key)
    SELECT NEW.id, item_key
      FROM (VALUES
        ('FINAL_FORMATS_CHECKED'),
        ('DRIVE_CLOSURE_COMPLETED'),
        ('PORTFOLIO_GIF_CREATED'),
        ('PROJECT_PPT_COMPLETED'),
        ('PORTFOLIO_UPDATE_COMPLETED'),
        ('INVOICE_ACCOUNTS_NOTIFIED')
      ) AS closure_items(item_key)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS add_project_closure_items_after_insert ON projects;
CREATE TRIGGER add_project_closure_items_after_insert
AFTER INSERT ON projects
FOR EACH ROW EXECUTE FUNCTION add_project_closure_items();

-- Backfill the standard checklist for projects created by older migrations.
INSERT INTO project_closure_items (project_id, item_key)
SELECT p.id, closure_items.item_key
  FROM projects p
 CROSS JOIN (VALUES
    ('FINAL_FORMATS_CHECKED'),
    ('DRIVE_CLOSURE_COMPLETED'),
    ('PORTFOLIO_GIF_CREATED'),
    ('PROJECT_PPT_COMPLETED'),
    ('PORTFOLIO_UPDATE_COMPLETED'),
    ('INVOICE_ACCOUNTS_NOTIFIED')
  ) AS closure_items(item_key)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION prevent_incomplete_project_closure()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'CLOSED' THEN
        IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'CLOSED' THEN
            IF (
                SELECT COUNT(*)
                  FROM project_closure_items pci
                 WHERE pci.project_id = NEW.id
                   AND pci.is_required
                   AND pci.is_completed
            ) <> 6 THEN
                RAISE EXCEPTION 'All required closure items must be completed before closing a project.'
                    USING ERRCODE = '23514';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_incomplete_project_closure_before_update ON projects;
CREATE TRIGGER prevent_incomplete_project_closure_before_update
BEFORE INSERT OR UPDATE OF status ON projects
FOR EACH ROW EXECUTE FUNCTION prevent_incomplete_project_closure();

CREATE OR REPLACE FUNCTION protect_closed_project_checklist()
RETURNS TRIGGER AS $$
DECLARE
    affected_project_id UUID;
    project_is_closed BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        affected_project_id := OLD.project_id;
    ELSE
        affected_project_id := NEW.project_id;
    END IF;
    SELECT status = 'CLOSED'
      INTO project_is_closed
      FROM projects
     WHERE id = affected_project_id;

    IF project_is_closed AND (
        TG_OP = 'DELETE'
        OR (OLD.is_required AND OLD.is_completed AND NOT NEW.is_completed)
    ) THEN
        RAISE EXCEPTION 'A required checklist item cannot be reopened or removed from a closed project.'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_closed_project_checklist_before_change
    ON project_closure_items;
CREATE TRIGGER protect_closed_project_checklist_before_change
BEFORE UPDATE OR DELETE ON project_closure_items
FOR EACH ROW EXECUTE FUNCTION protect_closed_project_checklist();

DROP TRIGGER IF EXISTS set_project_closure_items_updated_at ON project_closure_items;
CREATE TRIGGER set_project_closure_items_updated_at
BEFORE UPDATE ON project_closure_items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
