-- =========================================================
-- 22. NOTIFICATIONS
-- In-app notifications for task assignments, overdue tasks,
-- project deadlines, leave approval/rejection, weekly goal incomplete
-- and KPI/evaluation due events
-- =========================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    member_id UUID NOT NULL
        REFERENCES members(id)
        ON DELETE CASCADE,

    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) NOT NULL
        CHECK (
            type IN (
                'task_assignment',
                'overdue_task',
                'project_deadline',
                'leave_approval',
                'leave_rejection',
                'weekly_goal_incomplete',
                'kpi_evaluation_due'
            )
        ),

    entity_type VARCHAR(30),
    entity_id UUID,

    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,

    -- Prevent duplicate notifications for the same event
    UNIQUE (member_id, type, entity_type, entity_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_member_read ON notifications(member_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_member_created ON notifications(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Constraints for entity_type and entity_id relationship
ALTER TABLE notifications
ADD CONSTRAINT chk_notifications_entity
CHECK (
    (entity_type IS NULL AND entity_id IS NULL) OR
    (entity_type IS NOT NULL AND entity_id IS NOT NULL)
);