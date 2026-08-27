import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isUuid, textValue } from '@/lib/planner-validation';

interface TaskMasterPatchPayload {
  title?: unknown;
  category?: unknown;
  isActive?: unknown;
}

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/task-master/[id]'>,
) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: 'Invalid task id.' }, { status: 400 });

  let payload: TaskMasterPatchPayload;
  try {
    payload = await request.json() as TaskMasterPatchPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const changes: string[] = [];
  const values: unknown[] = [id];
  const add = (column: string, value: unknown) => {
    values.push(value);
    changes.push(`${column} = $${values.length}`);
  };

  if ('title' in payload) {
    const title = textValue(payload.title, 300);
    if (!title) return Response.json({ error: 'Task title is required.' }, { status: 400 });
    add('title', title);
  }
  if ('category' in payload) {
    const category = textValue(payload.category, 100);
    if (category === null) return Response.json({ error: 'Invalid task category.' }, { status: 400 });
    add('category', category || 'General');
  }
  if ('isActive' in payload) {
    if (typeof payload.isActive !== 'boolean') {
      return Response.json({ error: 'Invalid active status.' }, { status: 400 });
    }
    add('is_active', payload.isActive);
  }
  if (!changes.length) {
    return Response.json({ error: 'No supported task changes were provided.' }, { status: 400 });
  }

  try {
    const result = await db.query<{ id: string }>(
      `UPDATE task_master SET ${changes.join(', ')} WHERE id = $1 RETURNING id`,
      values,
    );
    if (!result.rows[0]) return Response.json({ error: 'Task not found.' }, { status: 404 });

    revalidatePath('/tasks');
    revalidatePath('/keys');
    revalidatePath('/reports');
    return Response.json({ task: { id } });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      return Response.json(
        { error: 'A task with this title already exists in that category.' },
        { status: 409 },
      );
    }
    console.error('Could not update task master item:', error);
    return Response.json({ error: 'Could not update the task.' }, { status: 500 });
  }
}
