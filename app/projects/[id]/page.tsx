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

  /*
   * IMPORTANT:
   * Project editing must show ALL active company members.
   *
   * Do not filter members by the project's department because
   * a project can contain members from Operation, Management,
   * CGI, AI, Editing, Production, Post Production, etc.
   */
  const activeMemberIds = new Set(
    structure.members
      .filter((member) => member.isActive !== false)
      .map((member) => member.id),
  );

  const allActiveMembers = workloads.filter((workload) =>
    activeMemberIds.has(workload.memberId),
  );

  /*
   * Used by the Edit Project form.
   * Department can be changed and then the corresponding
   * KEY / Goal can be selected.
   */
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