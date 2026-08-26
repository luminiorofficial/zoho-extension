import { Layout } from '@/components';
import WorkloadClient from '@/components/workload/WorkloadClient';
import { getMemberWorkloads } from '@/lib/workload-data';

export const dynamic = 'force-dynamic';

export default async function WorkloadPage() {
  const workloads = await getMemberWorkloads();
  const departmentNames = new Map<string, string>();

  for (const workload of workloads) {
    workload.departmentIds.forEach((id, index) => {
      departmentNames.set(id, workload.departmentNames[index] ?? 'Unnamed department');
    });
  }

  const departments = [...departmentNames]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return <Layout><WorkloadClient workloads={workloads} departments={departments} /></Layout>;
}
