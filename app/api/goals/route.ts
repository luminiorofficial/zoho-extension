import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isOptionalDate, isUuid, textValue } from '@/lib/planner-validation';

interface GoalPayload {
  departmentId?: unknown;
  ownerMemberId?: unknown;
  code?: unknown;
  title?: unknown;
  description?: unknown;
  status?: unknown;
  startDate?: unknown;
  endDate?: unknown;
}

const statuses = new Set(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'ON_HOLD', 'CANCELLED']);

export async function POST(request: Request) {
  let payload: GoalPayload;
  try {
    payload = await request.json() as GoalPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const code = textValue(payload.code, 100);
  const title = textValue(payload.title);
  const description = textValue(payload.description);
  const status = textValue(payload.status, 30) || 'NOT_STARTED';
  if (
    !isUuid(payload.departmentId) || !isUuid(payload.ownerMemberId) || !title
    || code === null || description === null || !statuses.has(status)
    || !isOptionalDate(payload.startDate) || !isOptionalDate(payload.endDate)
    || (payload.startDate && payload.endDate && payload.endDate < payload.startDate)
  ) {
    return Response.json(
      { error: 'Department, owner, title, valid status, and a valid date range are required.' },
      { status: 400 },
    );
  }

  try {
    const hierarchy = await db.query(
      `SELECT 1
         FROM departments d
         JOIN department_members dm ON dm.department_id = d.id
         JOIN members m ON m.id = dm.member_id
        WHERE d.id = $1 AND dm.member_id = $2 AND d.is_active AND m.is_active`,
      [payload.departmentId, payload.ownerMemberId],
    );
    if (!hierarchy.rows[0]) {
      return Response.json({ error: 'The goal owner must be an active member of the active department.' }, { status: 400 });
    }
    const duplicate = await db.query(
      `SELECT 1 FROM goals WHERE department_id = $1 AND LOWER(title) = LOWER($2) LIMIT 1`,
      [payload.departmentId, title],
    );
    if (duplicate.rows[0]) {
      return Response.json({ error: 'A goal with this title already exists in the department.' }, { status: 409 });
    }

    const result = await db.query<{ id: string }>(
      `INSERT INTO goals (
         department_id, owner_member_id, code, title, description, status, start_date, end_date
       ) VALUES ($1, $2, NULLIF($3, ''), $4, NULLIF($5, ''), $6, NULLIF($7, '')::date, NULLIF($8, '')::date)
       RETURNING id`,
      [payload.departmentId, payload.ownerMemberId, code, title, description, status, payload.startDate || '', payload.endDate || ''],
    );
    revalidatePath('/departments');
    revalidatePath(`/departments/${payload.departmentId}`);
    revalidatePath('/projects');
    return Response.json({ goal: { id: result.rows[0].id } }, { status: 201 });
  } catch (error) {
    console.error('Could not create goal:', error);
    return Response.json({ error: 'Could not create the goal.' }, { status: 500 });
  }
}
