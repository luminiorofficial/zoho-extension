import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { textValue, uuidArray } from '@/lib/planner-validation';

interface MemberPayload {
  name?: unknown;
  email?: unknown;
  role?: unknown;
  departmentIds?: unknown;
}

function validEmail(email: string): boolean {
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  let payload: MemberPayload;
  try {
    payload = await request.json() as MemberPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const name = textValue(payload.name, 200);
  const email = textValue(payload.email, 255);
  const role = textValue(payload.role, 200);
  const departmentIds = uuidArray(payload.departmentIds);
  if (!name || email === null || role === null || !validEmail(email) || !departmentIds?.length) {
    return Response.json(
      { error: 'Name, a valid email, role, and at least one department are required.' },
      { status: 400 },
    );
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const departments = await client.query<{ count: number }>(
      `SELECT COUNT(*)::integer AS count
         FROM departments WHERE id = ANY($1::uuid[]) AND is_active`,
      [departmentIds],
    );
    if (departments.rows[0].count !== departmentIds.length) {
      await client.query('ROLLBACK');
      return Response.json({ error: 'Every selected department must be active.' }, { status: 400 });
    }

    const result = await client.query<{ id: string }>(
      `INSERT INTO members (name, email, role_title)
       VALUES ($1, NULLIF($2, ''), NULLIF($3, '')) RETURNING id`,
      [name, email, role],
    );
    const memberId = result.rows[0].id;
    await client.query(
      `INSERT INTO department_members (department_id, member_id)
       SELECT UNNEST($1::uuid[]), $2`,
      [departmentIds, memberId],
    );
    await client.query('COMMIT');

    revalidatePath('/members');
    revalidatePath('/departments');
    for (const departmentId of departmentIds) revalidatePath(`/departments/${departmentId}`);
    return Response.json({ member: { id: memberId } }, { status: 201 });
  } catch (error) {
    await client.query('ROLLBACK');
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      return Response.json({ error: 'A member with this email already exists.' }, { status: 409 });
    }
    console.error('Could not create member:', error);
    return Response.json({ error: 'Could not create the member.' }, { status: 500 });
  } finally {
    client.release();
  }
}
