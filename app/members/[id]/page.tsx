import {
  notFound,
} from 'next/navigation';

import {
  Layout,
  MemberAttendancePanel,
  MemberWorkClient,
} from '@/components';

import {
  ZohoMemberProjectsPanel,
} from '@/components/zoho/ZohoRelationshipPanels';

import {
  getLeaveRequests,
  getMemberAttendanceSummary,
} from '@/lib/attendance-data';

import {
  getStructureData,
} from '@/lib/structure-data';

import {
  getMemberWorkData,
} from '@/lib/work-data';

import {
  getZohoMemberRelationshipState,
} from '@/lib/zoho/relationship-data';

export const dynamic =
  'force-dynamic';

interface MemberPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function MemberPage({
  params,
}: MemberPageProps) {
  const { id } = await params;

  const [
    {
      departments,
      members,
    },

    work,

    attendance,

    leaveRequests,

    zohoRelationship,
  ] = await Promise.all([
    getStructureData(),

    getMemberWorkData(id),

    getMemberAttendanceSummary(
      id,
    ),

    getLeaveRequests({
      memberId: id,
    }),

    getZohoMemberRelationshipState(
      id,
    ),
  ]);

  const member =
    members.find(
      (item) =>
        item.id === id,
    );

  if (!member) {
    notFound();
  }

  // -------------------------------------------------------
  // Department names
  // -------------------------------------------------------

  const departmentNames =
    (
      member.departmentIds
      ?? [
        member.departmentId,
      ]
    )
      .map(
        (departmentId) =>
          departments.find(
            (department) =>
              department.id
              === departmentId,
          )?.name,
      )
      .filter(
        (
          name,
        ): name is string =>
          Boolean(name),
      );

  // -------------------------------------------------------
  // Attendance departments
  // -------------------------------------------------------

  const memberDepartments =
    (
      member.departmentIds
      ?? [
        member.departmentId,
      ]
    )
      .map(
        (departmentId) =>
          departments.find(
            (department) =>
              department.id
              === departmentId,
          ),
      )
      .filter(
        (
          department,
        ): department is NonNullable<
          typeof department
        > =>
          Boolean(department),
      )
      .map(
        (department) => ({
          id:
            department.id,

          name:
            department.name,
        }),
      );

  // -------------------------------------------------------
  // IMPORTANT:
  //
  // Zoho = source of truth for which projects this member
  // actually works on.
  //
  // When Zoho relationship data is available, only mapped
  // Zoho projects belonging to this member are passed into
  // the Weekly Planner.
  //
  // If Zoho is temporarily unavailable, we safely fall
  // back to the existing local project_members data.
  // -------------------------------------------------------

  const zohoLocalProjectIds =
    new Set(
      zohoRelationship.status
        === 'READY'
        && zohoRelationship.data
        ? zohoRelationship.data
            .projects

            .map(
              (project) =>
                project.localProjectId,
            )

            .filter(
              (
                projectId,
              ): projectId is string =>
                Boolean(
                  projectId,
                ),
            )
        : [],
    );

  const shouldFilterByZoho =
    zohoRelationship.status
      === 'READY'
    && Boolean(
      zohoRelationship.data,
    );

  const filteredWork = {
    ...work,

    projects:
      shouldFilterByZoho
        ? work.projects.filter(
            (project) =>
              zohoLocalProjectIds.has(
                project.id,
              ),
          )
        : work.projects,
  };

  return (
    <Layout>
      <div className="mb-8">
        <p className="text-sm font-medium text-blue-600">
          Member Work Plan
        </p>

        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          {member.name}
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {member.role}
          {' · '}

          {departmentNames.join(
            ', ',
          ) || 'Unassigned'}

          {' · '}

          {member.team
            || 'No team'}
        </p>
      </div>

      <ZohoMemberProjectsPanel
        state={
          zohoRelationship
        }
      />

      <div className="mt-8">
        <MemberAttendancePanel
          member={member}
          departments={
            memberDepartments
          }
          summary={
            attendance
          }
          leaveRequests={
            leaveRequests
          }
        />
      </div>

      <div className="mt-8">
        <MemberWorkClient
          key={
            filteredWork.tasks
              .map(
                (task) =>
                  task.id,
              )
              .join(':')
          }
          member={member}
          initialWork={
            filteredWork
          }
        />
      </div>
    </Layout>
  );
}