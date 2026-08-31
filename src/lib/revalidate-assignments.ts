import 'server-only';

import { revalidatePath } from 'next/cache';

/**
 * Every page that reads from key_assignments (via getUnifiedWorkReport) needs to be
 * revalidated whenever a key assignment record changes, so that a single write is
 * immediately visible everywhere: Dashboard, Members (list + detail), Projects (list +
 * detail), Departments (list + detail), Reports, and Workload.
 */
export function revalidateKeyAssignmentViews(scope: {
  departmentId?: string;
  projectId?: string;
  memberId?: string;
} = {}): void {
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  revalidatePath('/workload');
  revalidatePath('/members');
  revalidatePath('/projects');
  revalidatePath('/departments');
  revalidatePath('/keys');

  if (scope.memberId) revalidatePath(`/members/${scope.memberId}`);
  if (scope.projectId) revalidatePath(`/projects/${scope.projectId}`);
  if (scope.departmentId) revalidatePath(`/departments/${scope.departmentId}`);
}
