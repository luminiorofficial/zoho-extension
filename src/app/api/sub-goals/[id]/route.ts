import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isUuid, subGoalTitleValue, textValue } from '@/lib/planner-validation';

interface SubGoalPatchPayload {
  title?: unknown;
  description?: unknown;
  isActive?: unknown;
}

export async function PATCH(request: Request, context: RouteContext<'/api/sub-goals/[id]'>) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: 'Invalid sub goal id.' }, { status: 400 });

  let payload: SubGoalPatchPayload;
  try {
    payload = await request.json() as SubGoalPatchPayload;
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
    const title = subGoalTitleValue(payload.title);
    if (!title) return Response.json({ error: 'Sub goal title is required.' }, { status: 400 });
    add('title', title);
  }

  if ('description' in payload) {
    const description = textValue(payload.description, 2000);
    if (description === null) return Response.json({ error: 'Invalid description.' }, { status: 400 });
    add('description', description || null);
  }

  if ('isActive' in payload) {
    if (typeof payload.isActive !== 'boolean') {
      return Response.json({ error: 'Invalid active status.' }, { status: 400 });
    }
    add('is_active', payload.isActive);
  }

  if (!changes.length) {
    return Response.json({ error: 'No supported sub goal changes were provided.' }, { status: 400 });
  }

  try {
    const result = await db.query<{ id: string }>(
      `UPDATE assignment_sub_goals SET ${changes.join(', ')} WHERE id = $1 RETURNING id`,
      values,
    );
    if (!result.rows[0]) return Response.json({ error: 'Sub goal not found.' }, { status: 404 });

    revalidatePath('/keys');
    return Response.json({ subGoal: { id } });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      return Response.json(
        { error: 'A sub goal with this title already exists under this key.' },
        { status: 409 },
      );
    }

    console.error('Could not update sub goal:', error);
    return Response.json({ error: 'Could not update the sub goal.' }, { status: 500 });
  }
}
