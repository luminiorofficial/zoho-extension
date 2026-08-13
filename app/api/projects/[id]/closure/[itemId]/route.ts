import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isUuid } from '@/lib/planner-validation';

interface ClosurePatchPayload {
  assignedMemberId?: unknown;
  completed?: unknown;
}

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/projects/[id]/closure/[itemId]'>,
) {
  const { id, itemId } = await context.params;
  if (!isUuid(id) || !isUuid(itemId)) {
    return Response.json({ error: 'Invalid project or checklist item id.' }, { status: 400 });
  }

  let payload: ClosurePatchPayload;
  try {
    payload = await request.json() as ClosurePatchPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if ('assignedMemberId' in payload && payload.assignedMemberId !== null && !isUuid(payload.assignedMemberId)) {
    return Response.json({ error: 'Invalid checklist assignee.' }, { status: 400 });
  }
  if ('completed' in payload && typeof payload.completed !== 'boolean') {
    return Response.json({ error: 'Invalid completion value.' }, { status: 400 });
  }
  if (!('assignedMemberId' in payload) && !('completed' in payload)) {
    return Response.json({ error: 'No checklist changes were provided.' }, { status: 400 });
  }

  try {
    const result = await db.query<{
      id: string;
      assigned_member_id: string | null;
      is_completed: boolean;
      department_id: string;
    }>(
      `UPDATE project_closure_items pci
          SET assigned_member_id = CASE
                WHEN $3::boolean THEN $4::uuid
                ELSE pci.assigned_member_id
              END,
              is_completed = CASE
                WHEN $5::boolean THEN $6::boolean
                ELSE pci.is_completed
              END,
              completed_at = CASE
                WHEN $5::boolean AND $6::boolean THEN NOW()
                WHEN $5::boolean THEN NULL
                ELSE pci.completed_at
              END
         FROM projects p
        WHERE pci.id = $2
          AND pci.project_id = $1
          AND p.id = pci.project_id
          AND (
            NOT $3::boolean
            OR $4::uuid IS NULL
            OR EXISTS (
              SELECT 1 FROM project_members pm
               WHERE pm.project_id = p.id AND pm.member_id = $4
            )
          )
          AND (
            NOT ($5::boolean AND $6::boolean)
            OR CASE WHEN $3::boolean THEN $4::uuid ELSE pci.assigned_member_id END IS NOT NULL
          )
        RETURNING pci.id, pci.assigned_member_id, pci.is_completed, p.department_id`,
      [
        id,
        itemId,
        'assignedMemberId' in payload,
        payload.assignedMemberId ?? null,
        'completed' in payload,
        payload.completed ?? false,
      ],
    );

    const item = result.rows[0];
    if (!item) {
      return Response.json(
        { error: 'Assign this checklist item to a project member before completing it.' },
        { status: 400 },
      );
    }

    revalidatePath(`/projects/${id}`);
    revalidatePath('/projects');
    revalidatePath(`/departments/${item.department_id}`);
    return Response.json({ item });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23514') {
      return Response.json(
        { error: 'A completed closure item cannot be reopened after the project is Closed.' },
        { status: 409 },
      );
    }
    console.error('Could not update closure checklist:', error);
    return Response.json({ error: 'Could not update the closure checklist.' }, { status: 500 });
  }
}
