import {
  DepartmentsClient,
  Layout,
} from '@/components';
import { getStructureData } from '@/lib/structure-data';

export const dynamic = 'force-dynamic';

export default async function DepartmentsPage() {
  const { departments } = await getStructureData();

  return (
    <Layout>
      <DepartmentsClient
        initialDepartments={departments}
      />
    </Layout>
  );
}
