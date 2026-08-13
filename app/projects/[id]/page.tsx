import { notFound } from 'next/navigation';

import { Layout } from '@/components';
import ProjectDetailClient from '@/components/projects/ProjectDetailClient';
import { getStructureData } from '@/lib/structure-data';
import { getProjectDetail } from '@/lib/work-data';
import { getMemberWorkloads } from '@/lib/workload-data';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: PageProps<'/projects/[id]'>) {
  const { id } = await params;
  const [project, structure, workloads] = await Promise.all([
    getProjectDetail(id),
    getStructureData(),
    getMemberWorkloads(),
  ]);
  if (!project) notFound();
  const department = structure.departments.find((item) => item.id === project.departmentId);
  const memberIds = new Set(department?.memberIds ?? []);
  const workloadsByMember = new Map(workloads.map((workload) => [workload.memberId, workload]));
  const departmentMembers = structure.members
    .filter((member) => memberIds.has(member.id))
    .flatMap((member) => {
      const workload = workloadsByMember.get(member.id);
      return workload ? [workload] : [];
    });
  return <Layout><ProjectDetailClient project={project} departmentMembers={departmentMembers} /></Layout>;
}
