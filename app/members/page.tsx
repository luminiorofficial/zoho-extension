import { Layout, MembersClient } from '@/components';
import { getStructureData } from '@/lib/structure-data';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const { departments, members } = await getStructureData();
  return (
    <Layout>
      <MembersClient
        initialMembers={members}
        departments={departments.map(({ id, name, isActive }) => ({ id, name, isActive }))}
      />
    </Layout>
  );
}
