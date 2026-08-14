import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isUuid, textValue } from '@/lib/planner-validation';

interface DepartmentPatchPayload {
  name?: unknown;
  description?: unknown;
  isActive?: unknown;
}

function refreshDepartment(id: string) {
  revalidatePath('/departments');
  revalidatePath(`/departments/${id}`);
  revalidatePath('/members');
  revalidatePath('/projects');
  revalidatePath('/workload');
  revalidatePath('/dashboard');
}

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/departments/[id]'>,
) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: 'Invalid department id.' }, { status: 400 });

  let payload: DepartmentPatchPayload;
  try {
    payload = await request.json() as DepartmentPatchPayload;
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
    if (!name) return Response.json({ error: 'Department name is required.' }, { status: 400 });
    const duplicate = await db.query(
      `SELECT 1 FROM departments WHERE LOWER(name) = LOWER($1) AND id <> $2 LIMIT 1`,
      [name, id],
    );
    if (duplicate.rows[0]) {
      return Response.json({ error: 'A department with this name already exists.' }, { status: 409 });
    }
    add('name', name);
  }
  if ('description' in payload) {
    const description = textValue(payload.description);
    if (description === null) return Response.json({ error: 'Invalid description.' }, { status: 400 });
    add('description', description || null);
  }
  if ('isActive' in payload) {
    if (typeof payload.isActive !== 'boolean') {
      return Response.json({ error: 'Active status must be true or false.' }, { status: 400 });
    }
    add('is_active', payload.isActive);
  }
  if (!changes.length) {
    return Response.json({ error: 'No supported department changes were provided.' }, { status: 400 });
  }

  try {
    const result = await db.query<{ id: string }>(
      `UPDATE departments SET ${changes.join(', ')} WHERE id = $1 RETURNING id`,
      values,
    );
    if (!result.rows[0]) return Response.json({ error: 'Department not found.' }, { status: 404 });
    refreshDepartment(id);
    return Response.json({ department: { id } });
  } catch (error) {
    console.error('Could not update department:', error);
    return Response.json({ error: 'Could not update the department.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<'/api/departments/[id]'>,
) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: 'Invalid department id.' }, { status: 400 });

  try {
    const result = await db.query<{ id: string }>(
      `UPDATE departments SET is_active = FALSE
        WHERE id = $1 AND is_active RETURNING id`,
      [id],
    );
    if (!result.rows[0]) {
      const exists = await db.query(`SELECT 1 FROM departments WHERE id = $1`, [id]);
      if (!exists.rows[0]) return Response.json({ error: 'Department not found.' }, { status: 404 });
    }
    refreshDepartment(id);
    return Response.json({ department: { id, isActive: false } });
  } catch (error) {
    console.error('Could not deactivate department:', error);
    return Response.json({ error: 'Could not deactivate the department.' }, { status: 500 });
  }
}
