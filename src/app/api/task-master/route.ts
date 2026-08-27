import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { textValue } from '@/lib/planner-validation';

interface TaskMasterPayload {
  title?: unknown;
  category?: unknown;
}

export async function POST(request: Request) {
  let payload: TaskMasterPayload;
  try {
    payload = await request.json() as TaskMasterPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const title = textValue(payload.title, 300);
  const category = payload.category === undefined ? 'General' : textValue(payload.category, 100);
  if (!title || category === null) {
    return Response.json({ error: 'Task title is required.' }, { status: 400 });
  }

  try {
    const result = await db.query<{ id: string }>(
      `INSERT INTO task_master (category, title)
       VALUES ($1, $2)
       RETURNING id`,
      [category || 'General', title],
    );
    revalidatePath('/tasks');
    revalidatePath('/keys');
    revalidatePath('/reports');
    return Response.json({ task: { id: result.rows[0].id } }, { status: 201 });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      return Response.json(
        { error: 'A task with this title already exists in that category.' },
        { status: 409 },
      );
    }
    console.error('Could not create task master item:', error);
    return Response.json({ error: 'Could not create the task.' }, { status: 500 });
  }
}
