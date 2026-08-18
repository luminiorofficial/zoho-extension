import { notFound } from 'next/navigation';

import { Layout } from '@/components';
import ProjectDetailClient from '@/components/projects/ProjectDetailClient';
import { getStructureData } from '@/lib/structure-data';
import { getProjectDetail } from '@/lib/work-data';
import { getMemberWorkloads } from '@/lib/workload-data';

export const dynamic = 'force-dynamic';

export default async function ProjectDetailPage({
  params,
}: PageProps<'/projects/[id]'>) {
  const { id } = await params;

  const [project, structure, workloads] = await Promise.all([
    getProjectDetail(id),
    getStructureData(),
    getMemberWorkloads(),
  ]);

  if (!project) {
    notFound();
  }

  // -------------------------------------------------------
  // ALL CURRENT ACTIVE MEMBERS
  // -------------------------------------------------------
  // Do NOT filter members by project department.
  //
  // A project may use people from:
  // AI
  // CGI
  // Editing
  // Production
  // Post Production
  // Management
  // etc.
  // -------------------------------------------------------

  const activeMemberIds = new Set(
    structure.members
      .filter((member) => member.isActive !== false)
      .map((member) => member.id),
  );

  const allActiveMembers = workloads.filter((workload) =>
    activeMemberIds.has(workload.memberId),
  );

  // -------------------------------------------------------
  // ACTIVE DEPARTMENTS + GOALS
  // These will be used by Edit Project so the client can
  // change OPERATION -> MANAGEMENT etc.
  // -------------------------------------------------------

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

  return (
    <Layout>
      <ProjectDetailClient
        project={project}
        departmentMembers={allActiveMembers}
        departments={departments}
      />
    </Layout>
  );
}