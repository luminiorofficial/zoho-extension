import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { isUuid } from '@/lib/planner-validation';

/**
 * Global search across departments, members, goals, actions, projects, and tasks.
 * Returns results grouped by entity type with links to their detail pages.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q')?.trim();
  const memberId = searchParams.get('memberId');

  if (!query) {
    return NextResponse.json({ results: { departments: [], members: [], goals: [], actions: [], projects: [], tasks: [] } });
  }

  // Prevent overly long search queries
  if (query.length > 200) {
    return NextResponse.json({ error: 'Search query too long.' }, { status: 400 });
  }

  const ilikePattern = `%${query}%`;
  const limit = 10;

  // Validate memberId if provided (for scoped results)
  if (memberId && !isUuid(memberId)) {
    return NextResponse.json({ error: 'Invalid member ID.' }, { status: 400 });
  }

  try {
    // Run all searches in parallel using a single pool query each
    // Using ILIKE with parameterized queries to prevent SQL injection
    const [
      departmentsResult,
      membersResult,
      goalsResult,
      actionsResult,
      projectsResult,
      tasksResult,
    ] = await Promise.all([
      // Departments search
      db.query<{
        id: string;
        name: string;
        description: string | null;
      }>(
        `SELECT id, name, description
         FROM departments
         WHERE is_active
           AND (name ILIKE $1 OR COALESCE(description, '') ILIKE $1)
         ORDER BY name
         LIMIT $2::integer`,
        [ilikePattern, limit],
      ),

      // Members search
      db.query<{
        id: string;
        name: string;
        email: string | null;
        role_title: string | null;
      }>(
        `SELECT id, name, email, role_title
         FROM members
         WHERE is_active
           AND (name ILIKE $1 OR COALESCE(email, '') ILIKE $1 OR COALESCE(role_title, '') ILIKE $1)
         ORDER BY name
         LIMIT $2::integer`,
        [ilikePattern, limit],
      ),

      // Goals search
      db.query<{
        id: string;
        department_id: string;
        department_name: string;
        code: string | null;
        title: string;
        description: string | null;
        status: string;
        progress_percent: number;
      }>(
        `SELECT g.id, g.department_id, d.name AS department_name,
                g.code, g.title, g.description, g.status, g.progress_percent
         FROM goals g
         JOIN departments d ON d.id = g.department_id
         WHERE g.is_active AND d.is_active
           AND (g.title ILIKE $1 OR COALESCE(g.code, '') ILIKE $1 OR COALESCE(g.description, '') ILIKE $1)
         ORDER BY g.title
         LIMIT $2::integer`,
        [ilikePattern, limit],
      ),

      // Actions search
      db.query<{
        id: string;
        goal_id: string;
        goal_title: string;
        code: string | null;
        title: string;
        description: string | null;
        priority: string | null;
        status: string;
        progress_percent: number;
      }>(
        `SELECT a.id, a.goal_id, g.title AS goal_title,
                a.code, a.title, a.description, a.priority, a.status, a.progress_percent
         FROM actions a
         JOIN goals g ON g.id = a.goal_id
         JOIN departments d ON d.id = g.department_id
         WHERE a.is_active AND g.is_active AND d.is_active
           AND (a.title ILIKE $1 OR COALESCE(a.code, '') ILIKE $1 OR COALESCE(a.description, '') ILIKE $1)
         ORDER BY a.title
         LIMIT $2::integer`,
        [ilikePattern, limit],
      ),

      // Projects search
      db.query<{
        id: string;
        department_id: string;
        department_name: string;
        goal_id: string;
        goal_title: string;
        code: string | null;
        name: string;
        description: string | null;
        status: string;
        budget: number | null;
      }>(
        `SELECT p.id, p.department_id, d.name AS department_name,
                p.goal_id, g.title AS goal_title,
                p.code, p.name, p.description, p.status, p.budget
         FROM projects p
         JOIN goals g ON g.id = p.goal_id
         JOIN departments d ON d.id = p.department_id
         WHERE p.is_active AND g.is_active AND d.is_active
           AND (p.name ILIKE $1 OR COALESCE(p.code, '') ILIKE $1 OR COALESCE(p.description, '') ILIKE $1)
         ORDER BY p.name
         LIMIT $2::integer`,
        [ilikePattern, limit],
      ),

      // Tasks search
      db.query<{
        id: string;
        title: string;
        description: string | null;
        status: string;
        task_date: string;
        project_id: string;
        project_name: string;
        action_id: string;
        action_title: string;
        assigned_member_id: string;
        assigned_member_name: string;
        week_start: string;
      }>(
        `SELECT t.id, t.title, t.description, t.status, t.task_date::text,
                t.project_id, p.name AS project_name,
                t.action_id, a.title AS action_title,
                t.assigned_member_id, m.name AS assigned_member_name,
                t.week_start::text AS week_start
         FROM tasks t
         JOIN week_goals wg ON wg.id = t.week_goal_id
         JOIN projects p ON p.id = t.project_id
         JOIN actions a ON a.id = t.action_id
         JOIN goals g ON g.id = p.goal_id
         JOIN departments d ON d.id = g.department_id
         JOIN members m ON m.id = t.assigned_member_id
         WHERE t.assigned_member_id = COALESCE($3::uuid, t.assigned_member_id)
           AND wg.is_active AND p.is_active AND a.is_active AND g.is_active AND d.is_active AND m.is_active
           AND (t.title ILIKE $1 OR COALESCE(t.description, '') ILIKE $1)
         ORDER BY t.task_date DESC
         LIMIT $2::integer`,
        memberId ? [ilikePattern, limit, memberId] : [ilikePattern, limit, null],
      ),
    ]);

    const results = {
      departments: departmentsResult.rows.map((row) => ({
        type: 'department' as const,
        id: row.id,
        title: row.name,
        description: row.description,
        subtitle: 'Department',
        href: `/departments/${row.id}`,
      })),
      members: membersResult.rows.map((row) => ({
        type: 'member' as const,
        id: row.id,
        title: row.name,
        description: row.email || row.role_title || null,
        subtitle: `Member${row.role_title ? ' — ' + row.role_title : ''}`,
        href: `/members/${row.id}`,
      })),
      goals: goalsResult.rows.map((row) => ({
        type: 'goal' as const,
        id: row.id,
        title: row.title,
        description: row.code ? `Code: ${row.code}` : null,
        subtitle: `${row.department_name} — Goal (${row.progress_percent}%)`,
        href: `/departments/${row.department_id}`,
      })),
      actions: actionsResult.rows.map((row) => ({
        type: 'action' as const,
        id: row.id,
        title: row.title,
        description: row.code ? `Code: ${row.code}` : null,
        subtitle: `${row.goal_title} — Action (${row.progress_percent}%)`,
        href: `/departments/${row.goal_id}`,
      })),
      projects: projectsResult.rows.map((row) => ({
        type: 'project' as const,
        id: row.id,
        title: row.name,
        description: row.code ? `Code: ${row.code}` : null,
        subtitle: `${row.goal_title} — Project`,
        href: `/projects/${row.id}`,
      })),
      tasks: tasksResult.rows.map((row) => ({
        type: 'task' as const,
        id: row.id,
        title: row.title,
        description: row.description,
        subtitle: `${row.project_name} — Task (${row.task_date})`,
        href: `/projects/${row.project_id}`,
      })),
    };

    const totalResults =
      results.departments.length +
      results.members.length +
      results.goals.length +
      results.actions.length +
      results.projects.length +
      results.tasks.length;

    return NextResponse.json({
      results,
      totalResults,
      query,
    });
  } catch (error) {
    console.error('Search failed:', error);
    return NextResponse.json({ error: 'Search failed.' }, { status: 500 });
  }
}