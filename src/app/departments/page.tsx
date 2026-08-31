import {
  DepartmentsClient,
  Layout,
} from '@/components';
import { getStructureData } from '@/lib/structure-data';
import { getUnifiedWorkReport } from '@/lib/unified-work-report';

export const dynamic = 'force-dynamic';

export default async function DepartmentsPage() {
  const [{ departments }, assignments] = await Promise.all([
    getStructureData(),
    getUnifiedWorkReport(),
  ]);

  // Department attribution must follow the assigned member's organisational
  // department (key_assignments -> member_id -> members.current_department_id),
  // never the project's department_id: a project can involve members from
  // multiple departments, so counting by project would misattribute work.
  const assignmentCounts = Object.fromEntries(
    assignments.reduce((counts, assignment) => {
      if (!assignment.department) return counts;
      counts.set(
        assignment.department.id,
        (counts.get(assignment.department.id) ?? 0) + 1,
      );
      return counts;
    }, new Map<string, number>()),
  );

  return (
    <Layout>
      <DepartmentsClient
        initialDepartments={departments}
        assignmentCounts={assignmentCounts}
      />
    </Layout>
  );
}
