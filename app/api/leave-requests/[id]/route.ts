import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isUuid } from '@/lib/planner-validation';

interface ReviewPayload {
  reviewerMemberId?: unknown;
  decision?: unknown;
  reviewNote?: unknown;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: 'Invalid leave request id.' }, { status: 400 });

  let payload: ReviewPayload;
  try {
    payload = await request.json() as ReviewPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const decision = payload.decision === 'APPROVED' || payload.decision === 'REJECTED'
    ? payload.decision
    : null;
  const reviewNote = typeof payload.reviewNote === 'string' ? payload.reviewNote.trim() : '';
  if (!isUuid(payload.reviewerMemberId) || !decision) {
    return Response.json({ error: 'Reviewer and Approve/Reject decision are required.' }, { status: 400 });
  }

  try {
    const result = await db.query<{
      id: string;
      memberId: string;
      departmentId: string;
      status: string;
    }>(
      `UPDATE leave_requests lr
          SET status = $3,
              reviewed_by_member_id = reviewer.id,
              review_note = NULLIF($4, ''),
              reviewed_at = NOW()
         FROM members reviewer
        WHERE lr.id = $1
          AND lr.status = 'PENDING'
          AND reviewer.id = $2
          AND reviewer.is_active
          AND (
            COALESCE(reviewer.role_title ILIKE '%admin%', FALSE)
            OR EXISTS (
              SELECT 1
                FROM department_members admin_membership
                JOIN departments admin_department
                  ON admin_department.id = admin_membership.department_id
               WHERE admin_membership.member_id = reviewer.id
                 AND UPPER(admin_department.name) = 'ADMIN'
            )
            OR EXISTS (
              SELECT 1
                FROM department_members reviewer_membership
               WHERE reviewer_membership.member_id = reviewer.id
                 AND reviewer_membership.department_id = lr.department_id
                 AND reviewer_membership.is_department_head
            )
          )
       RETURNING lr.id,
                 lr.member_id AS "memberId",
                 lr.department_id AS "departmentId",
                 lr.status`,
      [id, payload.reviewerMemberId, decision, reviewNote],
    );

    const leaveRequest = result.rows[0];
    if (!leaveRequest) {
      return Response.json(
        { error: 'Request is already reviewed, missing, or this reviewer is not its Department Head/Admin.' },
        { status: 403 },
      );
    }

    revalidatePath('/attendance');
    revalidatePath(`/members/${leaveRequest.memberId}`);
    revalidatePath(`/departments/${leaveRequest.departmentId}`);
    revalidatePath('/workload');
    return Response.json({ leaveRequest });
  } catch (error) {
    console.error('Could not review leave request:', error);
    return Response.json({ error: 'Could not review the leave request.' }, { status: 500 });
  }
}
