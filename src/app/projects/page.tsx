import {
  Layout,
} from '@/components';

import ProjectsClient
  from '@/components/projects/ProjectsClient';

import {
  getProjectPageContext,
} from '@/lib/project-detail-data';

import {
  getProjects,
} from '@/lib/work-data';

import {
  getMemberWorkloads,
} from '@/lib/workload-data';

import {
  syncAllZohoProjects,
} from '@/lib/zoho/project-sync';

export const dynamic =
  'force-dynamic';

export default async function ProjectsPage({
  searchParams,
}: PageProps<'/projects'>) {
  const query =
    await searchParams;

  const initialDepartmentId =
    typeof query.department ===
    'string'
      ? query.department
      : undefined;

  /*
   * Pull Zoho before reading the local list. The sync is idempotent and has a
   * short in-process TTL, so normal navigation does not repeatedly refresh the
   * OAuth token or hold a database connection during Zoho API requests.
   * A temporary Zoho outage must not hide existing CRM projects.
   */
  try {
    await syncAllZohoProjects();
  } catch (error) {
    console.error('Automatic Zoho project sync failed:', error);
  }

  /* =======================================================
   * No getStructureData().
   *
   * That old function also loaded:
   *
   * targets
   * actions
   * action assignees
   * department progress
   *
   * None of that is required to display/create projects.
   * ===================================================== */

  const [
    projects,
    pageContext,
  ] = await Promise.all([
    getProjects(
      null,
      null,
    ),

    getProjectPageContext(),
  ]);

  /* =======================================================
   * Only active members.
   * ===================================================== */

  const workloads =
    await getMemberWorkloads(
      pageContext.activeMemberIds,
    );

  const workloadsByMember =
    new Map(
      workloads.map(
        (workload) => [
          workload.memberId,
          workload,
        ],
      ),
    );

  const departments =
    pageContext.departments.map(
      (department) => ({
        id:
          department.id,

        name:
          department.name,

        goals:
          department.goals.map(
            (goal) => ({
              id:
                goal.id,

              title:
                goal.title,
            }),
          ),

        members:
          department.memberIds.flatMap(
            (memberId) => {
              const workload =
                workloadsByMember.get(
                  memberId,
                );

              return workload
                ? [
                    workload,
                  ]
                : [];
            },
          ),
      }),
    );

  return (
    <Layout>
      <ProjectsClient
        projects={
          projects
        }

        departments={
          departments
        }

        members={
          pageContext.members
        }

        initialDepartmentId={
          initialDepartmentId
        }

        openCreateInitially={
          query.new === '1'
        }
      />
    </Layout>
  );
}
