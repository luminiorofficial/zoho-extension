-- =========================================================
-- CLIENT MASTER DATA
-- Team Alignment = current employee master
-- CAC Projects    = current project master
-- =========================================================

ALTER TABLE members
    ADD COLUMN IF NOT EXISTS team VARCHAR(200);

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS master_job_no VARCHAR(500),
    ADD COLUMN IF NOT EXISTS project_type VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS ux_projects_master_job_no
    ON projects(master_job_no)
    WHERE master_job_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_active
    ON projects(is_active);

CREATE INDEX IF NOT EXISTS idx_members_active
    ON members(is_active);