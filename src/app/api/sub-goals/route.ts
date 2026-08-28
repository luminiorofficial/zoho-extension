import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isUuid, subGoalTitleValue, textValue } from '@/lib/planner-validation';

interface SubGoalPayload {
  keyId?: unknown;
  title?: unknown;
  description?: unknown;
}

export async function POST(request: Request) {
  let payload: SubGoalPayload;

  try {
    payload = await request.json() as SubGoalPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const title = subGoalTitleValue(payload.title);
  const description = payload.description === undefined
    ? ''
    : textValue(payload.description, 2000);

  if (!isUuid(payload.keyId) || !title || description === null) {
    return Response.json(
      { error: 'A valid key and sub goal title are required.' },
      { status: 400 },
    );
  }

  try {
    const keyResult = await db.query(
      `SELECT 1 FROM assignment_keys WHERE id = $1`,
      [payload.keyId],
    );
    if (!keyResult.rows[0]) {
      return Response.json({ error: 'The selected key does not exist.' }, { status: 400 });
    }

    const result = await db.query<{ id: string }>(
      `INSERT INTO assignment_sub_goals (key_id, title, description)
       VALUES ($1, $2, NULLIF($3, ''))
       RETURNING id`,
      [payload.keyId, title, description],
    );

    revalidatePath('/keys');

    return Response.json({ subGoal: { id: result.rows[0].id } }, { status: 201 });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      return Response.json(
        { error: 'A sub goal with this title already exists under this key.' },
        { status: 409 },
      );
    }

    console.error('Could not create sub goal:', error);
    return Response.json({ error: 'Could not create the sub goal.' }, { status: 500 });
  }
}
