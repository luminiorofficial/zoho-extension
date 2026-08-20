import { notFound } from 'next/navigation';

import { Layout } from '@/components';
import ProjectDetailClient from '@/components/projects/ProjectDetailClient';
import { ZohoProjectMembersPanel } from '@/components/zoho/ZohoRelationshipPanels';
import { getStructureData } from '@/lib/structure-data';
import { getProjectDetail } from '@/lib/work-data';
import { getMemberWorkloads } from '@/lib/workload-data';
import { getZohoProjectRelationshipState } from '@/lib/zoho/relationship-data';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({
  params,
  searchParams,
}: PageProps<'/projects/[id]'> & {
  searchParams: Promise<{
    embed?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const isZohoEmbed = query.embed === 'zoho';

  const [project, structure, workloads, zohoRelationship] =
    await Promise.all([
      getProjectDetail(id),
      getStructureData(),
      getMemberWorkloads(),
      getZohoProjectRelationshipState(id),
    ]);

  if (!project) {
    notFound();
  }

  const activeMemberIds = new Set(
    structure.members
      .filter((member) => member.isActive !== false)
      .map((member) => member.id),
  );

  const allActiveMembers = workloads.filter((workload) =>
    activeMemberIds.has(workload.memberId),
  );

  const departments = structure.departments
    .filter((department) => department.isActive)
    .map((department) => ({
      id: department.id,
      name: department.name,
      goals: department.goals
        .filter((goal) => goal.isActive !== false)
        .map((goal) => ({
          id: goal.id,
          title: goal.title,
          code: goal.code,
        })),
    }));

  const content = (
    <>
      <ProjectDetailClient
        project={project}
        departmentMembers={allActiveMembers}
        departments={departments}
      />

      <div className="mt-8">
        <ZohoProjectMembersPanel state={zohoRelationship} />
      </div>
    </>
  );

  if (isZohoEmbed) {
    return (
      <main className="min-h-screen bg-slate-50 p-5">
        <div className="mx-auto max-w-7xl">
          {content}
        </div>
      </main>
    );
  }

  return <Layout>{content}</Layout>;
}