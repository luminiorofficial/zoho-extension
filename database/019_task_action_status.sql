-- Add independent workflow status to task actions without changing existing
-- task-action records or the task status rollups.

ALTER TABLE task_actions
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED';

ALTER TABLE task_actions
    DROP CONSTRAINT IF EXISTS task_actions_status_check;

ALTER TABLE task_actions
    DROP CONSTRAINT IF EXISTS chk_task_actions_status;

ALTER TABLE task_actions
    ADD CONSTRAINT chk_task_actions_status
    CHECK (status IN ('NOT_STARTED', 'STARTED', 'IN_PROGRESS', 'DONE'));
