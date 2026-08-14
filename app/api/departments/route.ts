import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { textValue } from '@/lib/planner-validation';

interface DepartmentPayload {
  name?: unknown;
  description?: unknown;
}

export async function POST(request: Request) {
  let payload: DepartmentPayload;
  try {
    payload = await request.json() as DepartmentPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const name = textValue(payload.name, 200);
  const description = textValue(payload.description);
  if (!name || description === null) {
    return Response.json(
      { error: 'Department name is required and must be 200 characters or fewer.' },
      { status: 400 },
    );
  }

  try {
    const duplicate = await db.query(
      `SELECT 1 FROM departments WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [name],
    );
    if (duplicate.rows[0]) {
      return Response.json({ error: 'A department with this name already exists.' }, { status: 409 });
    }

    const result = await db.query<{ id: string }>(
      `INSERT INTO departments (name, description)
       VALUES ($1, NULLIF($2, '')) RETURNING id`,
      [name, description],
    );
    revalidatePath('/departments');
    revalidatePath('/dashboard');
    return Response.json({ department: { id: result.rows[0].id } }, { status: 201 });
  } catch (error) {
    console.error('Could not create department:', error);
    return Response.json({ error: 'Could not create the department.' }, { status: 500 });
  }
}
