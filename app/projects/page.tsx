import {
  Suspense,
} from 'react';

import {
  Layout,
} from '@/components';

import ProjectsClient
  from '@/components/projects/ProjectsClient';

import {
  AsyncZohoProjectMappingOverviewPanel,
  ZohoPanelSkeleton,
} from '@/components/zoho/AsyncZohoProjectPanels';

import {
  getProjectPageContext,
} from '@/lib/project-detail-data';

import {
  getProjects,
} from '@/lib/work-data';

import {
  getMemberWorkloads,
} from '@/lib/workload-data';

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
      {/* =================================================
       * This used to block the Projects page.
       *
       * Now Zoho loads separately.
       * =============================================== */}

      <div className="mb-7">
        <Suspense
          fallback={
            <ZohoPanelSkeleton
              title="Checking Zoho project mappings…"
            />
          }
        >
          <AsyncZohoProjectMappingOverviewPanel />
        </Suspense>
      </div>

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