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

  const assignmentCounts = Object.fromEntries(
    assignments.reduce((counts, assignment) => {
      counts.set(
        assignment.project.departmentId,
        (counts.get(assignment.project.departmentId) ?? 0) + 1,
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
