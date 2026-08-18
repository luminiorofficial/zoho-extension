DO $$
DECLARE
    department_record RECORD;
    key_record RECORD;
    v_goal_id UUID;
    v_action_id UUID;
BEGIN
    FOR department_record IN
        SELECT id, name
        FROM departments
        WHERE is_active = TRUE
    LOOP
        FOR key_record IN
            SELECT *
            FROM (
                VALUES
                    ('KEY_A', 'KEY A'),
                    ('KEY_B', 'KEY B'),
                    ('KEY_C', 'KEY C')
            ) AS keys(code, title)
        LOOP

            SELECT g.id
            INTO v_goal_id
            FROM goals g
            WHERE g.department_id = department_record.id
              AND g.code = key_record.code
            LIMIT 1;

            IF v_goal_id IS NULL THEN
                INSERT INTO goals (
                    department_id,
                    owner_member_id,
                    code,
                    title,
                    description,
                    status,
                    progress_percent,
                    is_active
                )
                VALUES (
                    department_record.id,
                    NULL,
                    key_record.code,
                    key_record.title,
                    'Default planning goal. Can be renamed later.',
                    'NOT_STARTED',
                    0,
                    TRUE
                )
                RETURNING id INTO v_goal_id;
            ELSE
                UPDATE goals
                SET is_active = TRUE,
                    updated_at = NOW()
                WHERE id = v_goal_id;
            END IF;

            SELECT a.id
            INTO v_action_id
            FROM actions a
            WHERE a.goal_id = v_goal_id
              AND a.code = 'GENERAL'
            LIMIT 1;

            IF v_action_id IS NULL THEN
                INSERT INTO actions (
                    goal_id,
                    code,
                    title,
                    description,
                    status,
                    progress_percent,
                    is_active
                )
                VALUES (
                    v_goal_id,
                    'GENERAL',
                    'General Weekly Work',
                    'Default action used for weekly planning.',
                    'NOT_STARTED',
                    0,
                    TRUE
                )
                RETURNING id INTO v_action_id;
            END IF;

            INSERT INTO action_assignees (
                action_id,
                member_id
            )
            SELECT
                v_action_id,
                dm.member_id
            FROM department_members dm
            JOIN members m
              ON m.id = dm.member_id
             AND m.is_active = TRUE
            WHERE dm.department_id = department_record.id
            ON CONFLICT DO NOTHING;

            v_goal_id := NULL;
            v_action_id := NULL;

        END LOOP;
    END LOOP;
END
$$;