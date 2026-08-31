import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;

interface SearchResultItem {
  type: string;
  id: string;
  title: string;
  description: string | null;
  subtitle: string;
  href: string;
}

interface GroupedResults {
  departments: SearchResultItem[];
  members: SearchResultItem[];
  keys: SearchResultItem[];
  subGoals: SearchResultItem[];
  projects: SearchResultItem[];
  tasks: SearchResultItem[];
}

function emptyResults(): GroupedResults {
  return { departments: [], members: [], keys: [], subGoals: [], projects: [], tasks: [] };
}

// Escape ILIKE wildcards so a literal "%" or "_" in the query is matched
// literally instead of being treated as a pattern.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function readableKeyCode(code: string): string {
  return code.replaceAll('_', ' ');
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function joinParts(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(' · ');
}

/**
 * Global search across departments, members, assignment keys/goals, sub goals,
 * projects, and task-master tasks -- the Key -> Sub Goal -> Project -> Task
 * -> Member hierarchy the /keys and /tasks pages read from today. The older
 * goals/actions/tasks hierarchy is no longer linked from any page, so it is
 * intentionally excluded here.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q')?.trim() ?? '';

  const limitParam = Number(searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(Math.floor(limitParam), MAX_LIMIT)
    : DEFAULT_LIMIT;

  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ results: emptyResults(), totalResults: 0, query });
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: 'Search query too long.' }, { status: 400 });
  }

  const ilikePattern = `%${escapeLikePattern(query)}%`;

  try {
    const [
      departmentsResult,
      membersResult,
      keysResult,
      subGoalsResult,
      projectsResult,
      tasksResult,
    ] = await Promise.all([
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

      db.query<{
        id: string;
        code: string;
        title: string;
        sub_goal_count: number;
      }>(
        `SELECT ak.id, ak.code, ak.title,
                (SELECT COUNT(*)::int FROM assignment_sub_goals sg
                  WHERE sg.key_id = ak.id AND sg.is_active) AS sub_goal_count
           FROM assignment_keys ak
          WHERE ak.title ILIKE $1
             OR ak.code ILIKE $1
             OR REPLACE(ak.code, '_', ' ') ILIKE $1
          ORDER BY ak.code
          LIMIT $2::integer`,
        [ilikePattern, limit],
      ),

      db.query<{
        id: string;
        title: string;
        description: string | null;
        key_id: string;
        key_title: string;
        key_code: string;
      }>(
        `SELECT sg.id, sg.title, sg.description, sg.key_id, ak.title AS key_title, ak.code AS key_code
           FROM assignment_sub_goals sg
           JOIN assignment_keys ak ON ak.id = sg.key_id
          WHERE sg.is_active
            AND (sg.title ILIKE $1 OR COALESCE(sg.description, '') ILIKE $1)
          ORDER BY sg.title
          LIMIT $2::integer`,
        [ilikePattern, limit],
      ),

      db.query<{
        id: string;
        name: string;
        code: string | null;
        description: string | null;
        department_name: string;
        member_count: number;
        sample_members: string[] | null;
        key_paths: string[] | null;
      }>(
        `SELECT p.id, p.name, p.code, p.description, d.name AS department_name,
                COALESCE(ctx.member_count, 0) AS member_count,
                ctx.sample_members, ctx.key_paths
           FROM projects p
           JOIN departments d ON d.id = p.department_id
           LEFT JOIN LATERAL (
             SELECT COUNT(DISTINCT ka.member_id)::int AS member_count,
                    (ARRAY_AGG(DISTINCT m.name ORDER BY m.name))[1:2] AS sample_members,
                    (ARRAY_AGG(
                      DISTINCT CONCAT(REPLACE(ak.code, '_', ' '), ' → ', sg.title)
                      ORDER BY CONCAT(REPLACE(ak.code, '_', ' '), ' → ', sg.title)
                    ))[1:2] AS key_paths
               FROM key_assignments ka
               JOIN assignment_keys ak ON ak.id = ka.key_id
               JOIN assignment_sub_goals sg ON sg.id = ka.sub_goal_id
               JOIN members m ON m.id = ka.member_id
              WHERE ka.project_id = p.id
           ) ctx ON TRUE
          WHERE p.is_active
            AND (p.name ILIKE $1 OR COALESCE(p.code, '') ILIKE $1 OR COALESCE(p.description, '') ILIKE $1)
          ORDER BY p.name
          LIMIT $2::integer`,
        [ilikePattern, limit],
      ),

      db.query<{
        id: string;
        category: string;
        title: string;
        member_count: number;
        project_count: number;
        sample_members: string[] | null;
        sample_projects: string[] | null;
        key_paths: string[] | null;
      }>(
        `SELECT tm.id, tm.category, tm.title,
                COALESCE(ctx.member_count, 0) AS member_count,
                COALESCE(ctx.project_count, 0) AS project_count,
                ctx.sample_members, ctx.sample_projects, ctx.key_paths
           FROM task_master tm
           LEFT JOIN LATERAL (
             SELECT COUNT(DISTINCT ka.member_id)::int AS member_count,
                    COUNT(DISTINCT ka.project_id)::int AS project_count,
                    (ARRAY_AGG(DISTINCT m.name ORDER BY m.name))[1:2] AS sample_members,
                    (ARRAY_AGG(DISTINCT p.name ORDER BY p.name))[1:2] AS sample_projects,
                    (ARRAY_AGG(
                      DISTINCT CONCAT(REPLACE(ak.code, '_', ' '), ' → ', sg.title)
                      ORDER BY CONCAT(REPLACE(ak.code, '_', ' '), ' → ', sg.title)
                    ))[1:2] AS key_paths
               FROM key_assignments ka
               JOIN members m ON m.id = ka.member_id
               JOIN assignment_keys ak ON ak.id = ka.key_id
               JOIN assignment_sub_goals sg ON sg.id = ka.sub_goal_id
               JOIN projects p ON p.id = ka.project_id
              WHERE ka.task_id = tm.id
           ) ctx ON TRUE
          WHERE tm.is_active
            AND (tm.title ILIKE $1 OR tm.category ILIKE $1)
          ORDER BY tm.title
          LIMIT $2::integer`,
        [ilikePattern, limit],
      ),
    ]);

    const results: GroupedResults = {
      departments: departmentsResult.rows.map((row) => ({
        type: 'department',
        id: row.id,
        title: row.name,
        description: row.description,
        subtitle: 'Department',
        href: `/departments/${row.id}`,
      })),

      members: membersResult.rows.map((row) => ({
        type: 'member',
        id: row.id,
        title: row.name,
        description: row.email,
        subtitle: row.role_title ? `Member — ${row.role_title}` : 'Member',
        href: `/members/${row.id}`,
      })),

      keys: keysResult.rows.map((row) => ({
        type: 'key',
        id: row.id,
        title: row.title,
        description: pluralize(row.sub_goal_count, 'sub goal'),
        subtitle: `${readableKeyCode(row.code)} · Key / Goal`,
        href: '/keys',
      })),

      subGoals: subGoalsResult.rows.map((row) => ({
        type: 'subGoal',
        id: row.id,
        title: row.title,
        description: row.description,
        subtitle: `${readableKeyCode(row.key_code)} · ${row.key_title} · Sub Goal`,
        href: '/keys',
      })),

      projects: projectsResult.rows.map((row) => ({
        type: 'project',
        id: row.id,
        title: row.name,
        description: joinParts([
          row.code ? `Code: ${row.code}` : row.description,
          row.sample_members?.length
            ? `Members: ${row.sample_members.join(', ')}${row.member_count > row.sample_members.length ? ' and others' : ''}`
            : null,
        ]),
        subtitle: joinParts([
          row.department_name,
          row.key_paths?.length ? row.key_paths.join(', ') : null,
        ]),
        href: `/projects/${row.id}`,
      })),

      tasks: tasksResult.rows.map((row) => ({
        type: 'task',
        id: row.id,
        title: row.title,
        description: row.sample_members?.length
          ? `Assigned to ${row.sample_members.join(', ')}${row.member_count > row.sample_members.length ? ' and others' : ''}`
          : 'Not yet assigned',
        subtitle: joinParts([
          row.category,
          row.key_paths?.length ? row.key_paths.join(', ') : null,
          row.sample_projects?.length
            ? `Projects: ${row.sample_projects.join(', ')}${row.project_count > row.sample_projects.length ? ' and others' : ''}`
            : null,
        ]),
        href: `/tasks/${row.id}`,
      })),
    };

    const totalResults = Object.values(results).reduce((sum, group) => sum + group.length, 0);

    return NextResponse.json({ results, totalResults, query });
  } catch (error) {
    console.error('Search failed:', error);
    return NextResponse.json({ error: 'Search failed.' }, { status: 500 });
  }
}
