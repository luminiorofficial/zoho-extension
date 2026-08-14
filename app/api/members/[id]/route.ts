import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isUuid, textValue, uuidArray } from '@/lib/planner-validation';

interface MemberPatchPayload {
  name?: unknown;
  email?: unknown;
  role?: unknown;
  departmentIds?: unknown;
  isActive?: unknown;
}

function validEmail(email: string): boolean {
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function refreshMember(id: string, departmentIds: string[]) {
  revalidatePath('/members');
  revalidatePath(`/members/${id}`);
  revalidatePath('/departments');
  revalidatePath('/projects');
  revalidatePath('/workload');
  revalidatePath('/dashboard');
  for (const departmentId of departmentIds) revalidatePath(`/departments/${departmentId}`);
}

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/members/[id]'>,
) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: 'Invalid member id.' }, { status: 400 });

  let payload: MemberPatchPayload;
  try {
    payload = await request.json() as MemberPatchPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const changes: string[] = [];
  const values: unknown[] = [id];
  const add = (column: string, value: unknown) => {
    values.push(value);
    changes.push(`${column} = $${values.length}`);
  };

  if ('name' in payload) {
    const name = textValue(payload.name, 200);
    if (!name) return Response.json({ error: 'Member name is required.' }, { status: 400 });
    add('name', name);
  }
  if ('email' in payload) {
    const email = textValue(payload.email, 255);
    if (email === null || !validEmail(email)) {
      return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    add('email', email || null);
  }
  if ('role' in payload) {
    const role = textValue(payload.role, 200);
    if (role === null) return Response.json({ error: 'Role is too long.' }, { status: 400 });
    add('role_title', role || null);
  }
  if ('isActive' in payload) {
    if (typeof payload.isActive !== 'boolean') {
      return Response.json({ error: 'Active status must be true or false.' }, { status: 400 });
    }
    add('is_active', payload.isActive);
  }

  let departmentIds: string[] | undefined;
  if ('departmentIds' in payload) {
    const parsed = uuidArray(payload.departmentIds);
    if (!parsed?.length) {
      return Response.json({ error: 'Select at least one department.' }, { status: 400 });
    }
    departmentIds = parsed;
  }
  if (!changes.length && departmentIds === undefined) {
    return Response.json({ error: 'No supported member changes were provided.' }, { status: 400 });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query<{ id: string }>(
      `SELECT id FROM members WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!current.rows[0]) {
      await client.query('ROLLBACK');
      return Response.json({ error: 'Member not found.' }, { status: 404 });
    }
    const membership = await client.query<{ department_id: string }>(
      `SELECT department_id FROM department_members WHERE member_id = $1`,
      [id],
    );
    const currentDepartmentIds = membership.rows.map((row) => row.department_id);
    if (departmentIds) {
      const departments = await client.query<{ count: number }>(
        `SELECT COUNT(*)::integer AS count
           FROM departments
          WHERE id = ANY($1::uuid[])
            AND (is_active OR id = ANY($2::uuid[]))`,
        [departmentIds, currentDepartmentIds],
      );
      if (departments.rows[0].count !== departmentIds.length) {
        await client.query('ROLLBACK');
        return Response.json({ error: 'Every selected department must be active.' }, { status: 400 });
      }

      const removed = currentDepartmentIds.filter((departmentId) => !departmentIds!.includes(departmentId));
      if (removed.length) {
        const linked = await client.query<{ is_linked: boolean }>(
          `SELECT
             EXISTS (
               SELECT 1 FROM goals g
                WHERE g.owner_member_id = $1 AND g.department_id = ANY($2::uuid[])
             ) OR EXISTS (
               SELECT 1 FROM action_assignees aa
               JOIN actions a ON a.id = aa.action_id
               JOIN goals g ON g.id = a.goal_id
                WHERE aa.member_id = $1 AND g.department_id = ANY($2::uuid[])
             ) OR EXISTS (
               SELECT 1 FROM projects p
               LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.member_id = $1
                WHERE p.department_id = ANY($2::uuid[])
                  AND (p.owner_member_id = $1 OR pm.member_id IS NOT NULL)
             ) OR EXISTS (
               SELECT 1 FROM week_plans wp
                WHERE wp.member_id = $1 AND wp.department_id = ANY($2::uuid[])
             ) OR EXISTS (
               SELECT 1 FROM leave_requests lr
                WHERE lr.member_id = $1 AND lr.department_id = ANY($2::uuid[])
             ) AS is_linked`,
          [id, removed],
        );
        if (linked.rows[0].is_linked) {
          await client.query('ROLLBACK');
          return Response.json(
            { error: 'This member has goals, actions, projects, plans, or leave records in a removed department. Deactivate the member instead.' },
            { status: 409 },
          );
        }
      }
    }

    if (changes.length) {
      await client.query(`UPDATE members SET ${changes.join(', ')} WHERE id = $1`, values);
    }
    if (departmentIds) {
      await client.query(
        `DELETE FROM department_members
          WHERE member_id = $1 AND NOT (department_id = ANY($2::uuid[]))`,
        [id, departmentIds],
      );
      await client.query(
        `INSERT INTO department_members (department_id, member_id)
         SELECT UNNEST($2::uuid[]), $1
         ON CONFLICT (department_id, member_id) DO NOTHING`,
        [id, departmentIds],
      );
    }
    await client.query('COMMIT');
    refreshMember(id, [...new Set([...currentDepartmentIds, ...(departmentIds ?? [])])]);
    return Response.json({ member: { id } });
  } catch (error) {
    await client.query('ROLLBACK');
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      return Response.json({ error: 'A member with this email already exists.' }, { status: 409 });
    }
    console.error('Could not update member:', error);
    return Response.json({ error: 'Could not update the member.' }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<'/api/members/[id]'>,
) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: 'Invalid member id.' }, { status: 400 });
  try {
    const result = await db.query<{ department_ids: string[] }>(
      `WITH updated AS (
         UPDATE members SET is_active = FALSE WHERE id = $1 RETURNING id
       )
       SELECT COALESCE(ARRAY_AGG(dm.department_id), '{}') AS department_ids
         FROM updated u LEFT JOIN department_members dm ON dm.member_id = u.id
        GROUP BY u.id`,
      [id],
    );
    if (!result.rows[0]) return Response.json({ error: 'Member not found.' }, { status: 404 });
    refreshMember(id, result.rows[0].department_ids);
    return Response.json({ member: { id, isActive: false } });
  } catch (error) {
    console.error('Could not deactivate member:', error);
    return Response.json({ error: 'Could not deactivate the member.' }, { status: 500 });
  }
}
