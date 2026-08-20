import { Layout } from '@/components';
import ProjectsClient from '@/components/projects/ProjectsClient';
import { ZohoProjectMappingOverviewPanel } from '@/components/zoho/ZohoRelationshipPanels';
import { getStructureData } from '@/lib/structure-data';
import { getProjects } from '@/lib/work-data';
import { getMemberWorkloads } from '@/lib/workload-data';
import { getZohoProjectMappingOverviewState } from '@/lib/zoho/relationship-data';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage({
  searchParams,
}: PageProps<'/projects'>) {
  const query = await searchParams;

  const initialDepartmentId =
    typeof query.department === 'string' ? query.department : undefined;

  const [projects, structure, workloads, zohoMappingOverview] = await Promise.all([
    getProjects(null, null),
    getStructureData(),
    getMemberWorkloads(),
    getZohoProjectMappingOverviewState(),
  ]);

  const workloadsByMember = new Map(
    workloads.map((workload) => [workload.memberId, workload]),
  );

  const departments = structure.departments
    .filter((department) => department.isActive)
    .map((department) => ({
      id: department.id,
      name: department.name,
      goals: department.goals
        .filter((goal) => goal.isActive !== false)
        .map((goal) => ({ id: goal.id, title: goal.title })),
      members: department.memberIds.flatMap((id) => {
        const workload = workloadsByMember.get(id);
        return workload ? [workload] : [];
      }),
    }));

  return (
    <Layout>
      <div className="mb-7">
        <ZohoProjectMappingOverviewPanel state={zohoMappingOverview} />
      </div>

      <ProjectsClient
        projects={projects}
        departments={departments}
        members={structure.members
          .filter((member) => member.isActive !== false)
          .map(({ id, name }) => ({ id, name }))}
        initialDepartmentId={initialDepartmentId}
        openCreateInitially={query.new === '1'}
      />
    </Layout>
  );
}