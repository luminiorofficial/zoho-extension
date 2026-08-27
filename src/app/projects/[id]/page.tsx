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
import AssignmentHierarchy from '@/components/assignments/AssignmentHierarchy';

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
import { getKeyAssignments } from '@/lib/key-assignment-data';

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
    keyAssignments,
  ] = await Promise.all([
    getProjectDetailOptimized(
      id,
    ),

    getProjectPageContext(),
    getKeyAssignments({ projectId: id }),
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

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Key Assignments</h2>
          <p className="mt-1 text-sm text-slate-500">Keys and sub goals assigned to this project, with independent tasks, members, and dates.</p>
        </div>
        <AssignmentHierarchy assignments={keyAssignments} view="project" />
      </section>

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
