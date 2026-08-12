import {
  DepartmentsClient,
  Layout,
} from '@/components';

import { mockData } from '@/data/mockData';

export default function DepartmentsPage() {
  return (
    <Layout>
      <DepartmentsClient
        initialDepartments={mockData.departments}
      />
    </Layout>
  );
}