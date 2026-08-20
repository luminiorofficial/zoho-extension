import {
  Suspense,
} from 'react';

import {
  notFound,
} from 'next/navigation';

import {
  Layout,
} from '@/components';

import ProjectDetailClient
  from '@/components/projects/ProjectDetailClient';

import {
  AsyncZohoProjectMembersPanel,
  ZohoPanelSkeleton,
} from '@/components/zoho/AsyncZohoProjectPanels';

import {
  getProjectDetailOptimized,
  getProjectPageContext,
} from '@/lib/project-detail-data';

import {
  getMemberWorkloads,
} from '@/lib/workload-data';

export const dynamic =
  'force-dynamic';

export default async function ProjectDetailPage({
  params,
  searchParams,
}: PageProps<'/projects/[id]'> & {
  searchParams: Promise<{
    embed?: string;
  }>;
}) {
  const {
    id,
  } = await params;

  const query =
    await searchParams;

  const isZohoEmbed =
    query.embed === 'zoho';

  /* =======================================================
   * IMPORTANT:
   *
   * We no longer call:
   *
   * getStructureData()
   *
   * and we no longer fetch Zoho here.
   *
   * The local project data can therefore finish without
   * waiting for the expensive Zoho relationship snapshot.
   * ===================================================== */

  const [
    project,
    pageContext,
  ] = await Promise.all([
    getProjectDetailOptimized(
      id,
    ),

    getProjectPageContext(),
  ]);

  if (!project) {
    notFound();
  }

  /* =======================================================
   * Only calculate workloads for active members.
   *
   * workload-query.ts now also applies this member filter
   * inside its expensive CTE calculations.
   * ===================================================== */

  const allActiveMembers =
    await getMemberWorkloads(
      pageContext.activeMemberIds,
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

              code:
                goal.code,
            }),
          ),
      }),
    );

  const content = (
    <>
      <ProjectDetailClient
        project={project}
        departmentMembers={
          allActiveMembers
        }
        departments={
          departments
        }
      />

      {/* =================================================
       * Zoho loads independently.
       *
       * If Zoho takes 3 seconds, the local project page
       * no longer needs to wait those 3 seconds.
       * =============================================== */}

      <div className="mt-8">
        <Suspense
          fallback={
            <ZohoPanelSkeleton
              title="Loading live Zoho project members and tasks…"
            />
          }
        >
          <AsyncZohoProjectMembersPanel
            projectId={id}
          />
        </Suspense>
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

  return (
    <Layout>
      {content}
    </Layout>
  );
}