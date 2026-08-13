import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';

interface ProjectPayload {
  departmentId?: unknown;
  goalId?: unknown;
  name?: unknown;
  description?: unknown;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request) {
  let payload: ProjectPayload;

  try {
    payload = await request.json() as ProjectPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const description = typeof payload.description === 'string'
    ? payload.description.trim()
    : '';

  if (!isUuid(payload.departmentId) || !isUuid(payload.goalId) || !name) {
    return Response.json(
      { error: 'Department, goal, and project name are required.' },
      { status: 400 },
    );
  }

  try {
    const result = await db.query(
      `INSERT INTO projects (department_id, goal_id, name, description)
       SELECT $1, g.id, $3, NULLIF($4, '')
         FROM goals g
        WHERE g.id = $2
          AND g.department_id = $1
       RETURNING id, department_id, goal_id, name, description, status`,
      [payload.departmentId, payload.goalId, name, description],
    );

    if (!result.rows[0]) {
      return Response.json(
        { error: 'The selected goal does not belong to this department.' },
        { status: 400 },
      );
    }

    revalidatePath(`/departments/${payload.departmentId}`);
    revalidatePath('/departments');

    return Response.json({ project: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      return Response.json(
        { error: 'A project with this name already exists in the department.' },
        { status: 409 },
      );
    }

    console.error('Could not create project:', error);
    return Response.json({ error: 'Could not create the project.' }, { status: 500 });
  }
}
