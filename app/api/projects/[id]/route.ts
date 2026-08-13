import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isDate, isUuid } from '@/lib/planner-validation';

interface ProjectPatchPayload {
  clientName?: unknown;
  name?: unknown;
  jobCode?: unknown;
  description?: unknown;
  ownerId?: unknown;
  memberIds?: unknown;
  startDate?: unknown;
  deadline?: unknown;
  status?: unknown;
  budget?: unknown;
}

const statuses = new Set([
  'PLANNED', 'ACTIVE', 'INTERNAL_REVIEW', 'CLIENT_REVIEW',
  'DELIVERED', 'CLOSURE_PENDING', 'CLOSED',
]);

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/projects/[id]'>,
) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: 'Invalid project id.' }, { status: 400 });

  let payload: ProjectPatchPayload;
  try {
    payload = await request.json() as ProjectPatchPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const changes: string[] = [];
  const values: unknown[] = [id];
  const addChange = (sql: string, value: unknown) => {
    values.push(value);
    changes.push(`${sql} = $${values.length}`);
  };

  for (const [field, column] of [
    ['clientName', 'client_name'],
    ['name', 'name'],
    ['jobCode', 'code'],
  ] as const) {
    if (field in payload) {
      const value = cleanText(payload[field]);
      if (!value) return Response.json({ error: `${field} cannot be empty.` }, { status: 400 });
      addChange(column, value);
    }
  }

  if ('description' in payload) addChange('description', cleanText(payload.description) || null);

  if ('ownerId' in payload) {
    if (!isUuid(payload.ownerId)) {
      return Response.json({ error: 'Select a valid project owner.' }, { status: 400 });
    }
    addChange('owner_member_id', payload.ownerId);
  }

  if ('startDate' in payload) {
    if (!isDate(payload.startDate)) return Response.json({ error: 'Invalid start date.' }, { status: 400 });
    addChange('start_date', payload.startDate);
  }

  if ('deadline' in payload) {
    if (!isDate(payload.deadline)) return Response.json({ error: 'Invalid deadline.' }, { status: 400 });
    addChange('end_date', payload.deadline);
  }

  if ('status' in payload) {
    const status = cleanText(payload.status);
    if (!statuses.has(status)) return Response.json({ error: 'Invalid project status.' }, { status: 400 });
    addChange('status', status);
  }

  if ('budget' in payload) {
    const budget = typeof payload.budget === 'number' ? payload.budget : Number(cleanText(payload.budget));
    if (!Number.isFinite(budget) || budget < 0) {
      return Response.json({ error: 'Budget must be zero or greater.' }, { status: 400 });
    }
    addChange('budget', budget);
  }

  let requestedMemberIds: string[] | undefined;
  if ('memberIds' in payload) {
    if (!Array.isArray(payload.memberIds) || payload.memberIds.some((memberId) => !isUuid(memberId))) {
      return Response.json({ error: 'Invalid assigned members.' }, { status: 400 });
    }
    requestedMemberIds = [...new Set(payload.memberIds)];
  }

  if (!changes.length && requestedMemberIds === undefined) {
    return Response.json({ error: 'No supported project changes were provided.' }, { status: 400 });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const currentResult = await client.query<{
      department_id: string;
      owner_member_id: string | null;
    }>(
      `SELECT department_id, owner_member_id FROM projects WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const current = currentResult.rows[0];
    if (!current) {
      await client.query('ROLLBACK');
      return Response.json({ error: 'Project not found.' }, { status: 404 });
    }

    const nextOwnerId = isUuid(payload.ownerId) ? payload.ownerId : current.owner_member_id;
    const nextMemberIds = requestedMemberIds === undefined
      ? undefined
      : [...new Set(nextOwnerId ? [nextOwnerId, ...requestedMemberIds] : requestedMemberIds)];
    const membersToValidate = [...new Set([
      ...(nextOwnerId ? [nextOwnerId] : []),
      ...(nextMemberIds ?? []),
    ])];

    if (membersToValidate.length) {
      const validResult = await client.query<{ count: number }>(
        `SELECT COUNT(*)::integer AS count
           FROM department_members
          WHERE department_id = $1
            AND member_id = ANY($2::uuid[])`,
        [current.department_id, membersToValidate],
      );
      if (validResult.rows[0].count !== membersToValidate.length) {
        await client.query('ROLLBACK');
        return Response.json(
          { error: 'The owner and assigned members must belong to the project department.' },
          { status: 400 },
        );
      }
    }

    if (nextMemberIds !== undefined) {
      const linkedResult = await client.query<{ member_id: string }>(
        `SELECT assigned_member_id AS member_id
           FROM week_goals
          WHERE project_id = $1
         UNION
         SELECT assigned_member_id AS member_id
           FROM project_closure_items
          WHERE project_id = $1
            AND assigned_member_id IS NOT NULL`,
        [id],
      );
      const omittedLinkedMember = linkedResult.rows.some((row) => !nextMemberIds.includes(row.member_id));
      if (!nextMemberIds.length || omittedLinkedMember) {
        await client.query('ROLLBACK');
        return Response.json(
          { error: 'Members linked to weekly goals or closure items cannot be removed.' },
          { status: 409 },
        );
      }
    }

    if (changes.length) {
      await client.query(
        `UPDATE projects SET ${changes.join(', ')} WHERE id = $1`,
        values,
      );
    }

    if (nextMemberIds !== undefined) {
      await client.query('DELETE FROM project_members WHERE project_id = $1', [id]);
      await client.query(
        `INSERT INTO project_members (project_id, member_id)
         SELECT $1, UNNEST($2::uuid[])`,
        [id, nextMemberIds],
      );
    }

    await client.query('COMMIT');
    revalidatePath('/projects');
    revalidatePath('/workload');
    revalidatePath(`/projects/${id}`);
    revalidatePath(`/departments/${current.department_id}`);
    revalidatePath('/dashboard');
    return Response.json({ project: { id } });
  } catch (error) {
    await client.query('ROLLBACK');
    if (typeof error === 'object' && error && 'code' in error && error.code === '23514') {
      return Response.json(
        { error: 'Complete every required job closure item before marking this project Closed.' },
        { status: 409 },
      );
    }
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      return Response.json({ error: 'That project name is already in use.' }, { status: 409 });
    }
    console.error('Could not update project:', error);
    return Response.json({ error: 'Could not update the project.' }, { status: 500 });
  } finally {
    client.release();
  }
}
