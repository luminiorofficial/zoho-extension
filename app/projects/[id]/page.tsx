import { notFound } from 'next/navigation';

import { Layout } from '@/components';
import ProjectDetailClient from '@/components/projects/ProjectDetailClient';
import { getStructureData } from '@/lib/structure-data';
import { getProjectDetail } from '@/lib/work-data';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({ params }: PageProps<'/projects/[id]'>) {
  const { id } = await params;
  const [project, structure] = await Promise.all([getProjectDetail(id), getStructureData()]);
  if (!project) notFound();
  const department = structure.departments.find((item) => item.id === project.departmentId);
  const memberIds = new Set(department?.memberIds ?? []);
  const departmentMembers = structure.members.filter((member) => memberIds.has(member.id)).map(({ id: memberId, name }) => ({ id: memberId, name }));
  return <Layout><ProjectDetailClient project={project} departmentMembers={departmentMembers} /></Layout>;
}
