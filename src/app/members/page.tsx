import { Layout, MembersClient } from '@/components';
import { getStructureData } from '@/lib/structure-data';
import { getUnifiedWorkReport } from '@/lib/unified-work-report';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const [{ departments, members }, assignments] = await Promise.all([
    getStructureData(),
    getUnifiedWorkReport(),
  ]);

  const activeMembers = members.filter(
    (member) => member.isActive !== false,
  );
  const assignmentCounts = Object.fromEntries(
    assignments.reduce((counts, assignment) => {
      counts.set(
        assignment.member.id,
        (counts.get(assignment.member.id) ?? 0) + 1,
      );
      return counts;
    }, new Map<string, number>()),
  );

  return (
    <Layout>
      <MembersClient
        initialMembers={activeMembers}
        departments={departments.map(
          ({ id, name, isActive }) => ({
            id,
            name,
            isActive,
          }),
        )}
        assignmentCounts={assignmentCounts}
      />
    </Layout>
  );
}
