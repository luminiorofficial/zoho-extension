-- =========================================================
-- CURRENT MEMBER DEPARTMENT
--
-- department_members keeps historical relationships.
-- members.current_department_id stores the employee's
-- CURRENT department from Team Alignment.xlsx.
-- =========================================================

ALTER TABLE members
ADD COLUMN IF NOT EXISTS current_department_id UUID
REFERENCES departments(id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_members_current_department
ON members(current_department_id);