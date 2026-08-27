import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isUuid, textValue } from '@/lib/planner-validation';

interface AssignmentKeyPatchPayload {
  title?: unknown;
}

function refreshKeys() {
  revalidatePath('/keys');
  revalidatePath('/departments');
  revalidatePath('/projects');
  revalidatePath('/reports');
}

export async function PATCH(request: Request, context: RouteContext<'/api/keys/[id]'>) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: 'Invalid key id.' }, { status: 400 });

  let payload: AssignmentKeyPatchPayload;
  try {
    payload = await request.json() as AssignmentKeyPatchPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const title = textValue(payload.title, 200);
  if (!title) {
    return Response.json({ error: 'Key title is required.' }, { status: 400 });
  }

  try {
    const result = await db.query<{ id: string }>(
      `UPDATE assignment_keys SET title = $2 WHERE id = $1 RETURNING id`,
      [id, title],
    );
    if (!result.rows[0]) return Response.json({ error: 'Key not found.' }, { status: 404 });

    refreshKeys();
    return Response.json({ key: { id, title } });
  } catch (error) {
    console.error('Could not update key:', error);
    return Response.json({ error: 'Could not update the key.' }, { status: 500 });
  }
}
