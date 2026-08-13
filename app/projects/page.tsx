import { Layout } from '@/components';
import ProjectsClient from '@/components/projects/ProjectsClient';
import { getStructureData } from '@/lib/structure-data';
import { getProjects } from '@/lib/work-data';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage({ searchParams }: PageProps<'/projects'>) {
  const query = await searchParams;
  const initialDepartmentId = typeof query.department === 'string' ? query.department : undefined;
  const [projects, structure] = await Promise.all([getProjects(null, null), getStructureData()]);
  const membersById = new Map(structure.members.map((member) => [member.id, member]));
  const departments = structure.departments.map((department) => ({
    id: department.id,
    name: department.name,
    goals: department.goals.map((goal) => ({ id: goal.id, title: goal.title })),
    members: department.memberIds.flatMap((id) => {
      const member = membersById.get(id);
      return member ? [{ id: member.id, name: member.name }] : [];
    }),
  }));

  return <Layout><ProjectsClient projects={projects} departments={departments} members={structure.members.map(({ id, name }) => ({ id, name }))} initialDepartmentId={initialDepartmentId} openCreateInitially={query.new === '1'} /></Layout>;
}
