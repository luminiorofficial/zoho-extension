export const MEMBER_WORKLOAD_QUERY = `
  WITH active_projects AS (
    SELECT pm.member_id,
           COUNT(*)::integer AS active_project_count,
           JSONB_AGG(
             JSONB_BUILD_OBJECT(
               'id', p.id,
               'name', p.name,
               'jobCode', p.code,
               'status', p.status,
               'deadline', TO_CHAR(p.end_date, 'YYYY-MM-DD')
             )
             ORDER BY p.end_date NULLS LAST, p.name
           ) AS active_projects
      FROM project_members pm
      JOIN projects p ON p.id = pm.project_id
     WHERE p.status IN ('ACTIVE', 'INTERNAL_REVIEW', 'CLIENT_REVIEW', 'CLOSURE_PENDING')
     GROUP BY pm.member_id
  ),
  task_metrics AS (
    SELECT assigned_member_id AS member_id,
           COUNT(*) FILTER (WHERE status <> 'DONE')::integer AS open_task_count,
           COUNT(*) FILTER (
             WHERE status <> 'DONE'
               AND task_date BETWEEN DATE_TRUNC('week', CURRENT_DATE)::date
                                 AND DATE_TRUNC('week', CURRENT_DATE)::date + 6
           )::integer AS due_this_week_task_count,
           COUNT(*) FILTER (
             WHERE status = 'DONE'
               AND task_date BETWEEN DATE_TRUNC('week', CURRENT_DATE)::date
                                 AND DATE_TRUNC('week', CURRENT_DATE)::date + 6
           )::integer AS completed_this_week_task_count,
           COUNT(*) FILTER (
             WHERE status <> 'DONE' AND task_date < CURRENT_DATE
           )::integer AS overdue_task_count
      FROM tasks
     GROUP BY assigned_member_id
  )
  SELECT m.id AS member_id,
         m.name AS member_name,
         m.email,
         m.role_title,
         ARRAY(
           SELECT dm.department_id
             FROM department_members dm
             JOIN departments d ON d.id = dm.department_id
            WHERE dm.member_id = m.id
            ORDER BY d.name, d.id
         ) AS department_ids,
         ARRAY(
           SELECT d.name
             FROM department_members dm
             JOIN departments d ON d.id = dm.department_id
            WHERE dm.member_id = m.id
            ORDER BY d.name, d.id
         ) AS department_names,
         COALESCE(ap.active_project_count, 0)::integer AS active_project_count,
         COALESCE(tm.open_task_count, 0)::integer AS open_task_count,
         COALESCE(tm.due_this_week_task_count, 0)::integer AS due_this_week_task_count,
         COALESCE(tm.completed_this_week_task_count, 0)::integer AS completed_this_week_task_count,
         COALESCE(tm.overdue_task_count, 0)::integer AS overdue_task_count,
         COALESCE(today_attendance.status, 'ABSENT') AS availability_status,
         COALESCE(ap.active_projects, '[]'::jsonb) AS active_projects
    FROM members m
    LEFT JOIN active_projects ap ON ap.member_id = m.id
    LEFT JOIN task_metrics tm ON tm.member_id = m.id
    LEFT JOIN attendance_history today_attendance
      ON today_attendance.member_id = m.id
     AND today_attendance.attendance_date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date
   WHERE ($1::uuid[] IS NULL OR m.id = ANY($1::uuid[]))
   ORDER BY m.name, m.id
`;
