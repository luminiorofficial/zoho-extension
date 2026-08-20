import type { QueryResultRow } from 'pg';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { notFound } from 'next/navigation';

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

import { db } from '@/lib/db';

import {
  getMemberWorkData,
} from '@/lib/work-data';

import {
  getZohoMemberRelationshipState,
} from '@/lib/zoho/relationship-data';

import type {
  Member,
} from '@/types';

export const dynamic = 'force-dynamic';

/* =========================================================
 * TYPES
 * ======================================================= */

interface MemberPageProps {
  params: Promise<{
    id: string;
  }>;
}

interface MemberRow extends QueryResultRow {
  id: string;
  name: string;
  email: string | null;
  role_title: string | null;
  team: string | null;
  current_department_id: string | null;
  is_active: boolean;

  department_name: string | null;
}

/* =========================================================
 * ACCORDION
 *
 * Kept directly in this file so you do NOT need to create
 * another component.
 * ======================================================= */

interface AccordionSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

function AccordionSection({
  title,
  description,
  children,
  defaultOpen = false,
}: AccordionSectionProps) {
  return (
    <details
      open={defaultOpen}
      className="
        group
        overflow-hidden
        rounded-2xl
        border
        border-slate-200
        bg-white
        shadow-sm
        transition
        open:shadow-md
      "
    >
      <summary
        className="
          flex
          cursor-pointer
          list-none
          items-center
          justify-between
          gap-4
          px-5
          py-4
          transition
          hover:bg-slate-50
          sm:px-6
          sm:py-5
          [&::-webkit-details-marker]:hidden
        "
      >
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-900">
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-sm text-slate-500">
              {description}
            </p>
          )}
        </div>

        <span
          className="
            flex
            h-9
            w-9
            shrink-0
            items-center
            justify-center
            rounded-lg
            bg-slate-100
            text-slate-500
            transition
            group-open:bg-blue-50
            group-open:text-blue-600
          "
        >
          <ChevronDown
            size={18}
            className="
              transition-transform
              duration-200
              group-open:rotate-180
            "
          />
        </span>
      </summary>

      <div className="border-t border-slate-100 p-4 sm:p-6">
        {children}
      </div>
    </details>
  );
}

/* =========================================================
 * MEMBER QUERY
 *
 * IMPORTANT:
 * We do NOT call getStructureData() here anymore.
 *
 * getStructureData() loads:
 * - all departments
 * - all members
 * - all goals
 * - all targets
 * - all actions
 * - all action assignees
 *
 * That is unnecessary when opening one member.
 * ======================================================= */

async function getMember(
  memberId: string,
): Promise<{
  member: Member;
  departments: {
    id: string;
    name: string;
  }[];
} | null> {
  const result = await db.query<MemberRow>(
    `
      SELECT
        m.id,
        m.name,
        m.email,
        m.role_title,
        m.team,
        m.current_department_id,
        m.is_active,

        d.name AS department_name

      FROM members m

      LEFT JOIN departments d
        ON d.id = m.current_department_id

      WHERE
        m.id = $1

      LIMIT 1
    `,
    [memberId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const departmentId =
    row.current_department_id ?? '';

  const member: Member = {
    id: row.id,

    name: row.name,

    email:
      row.email ?? '—',

    role:
      row.role_title ?? '—',

    team:
      row.team ?? '—',

    departmentId,

    departmentIds:
      departmentId
        ? [departmentId]
        : [],

    isActive:
      row.is_active,
  };

  const departments =
    departmentId && row.department_name
      ? [
          {
            id:
              departmentId,

            name:
              row.department_name,
          },
        ]
      : [];

  return {
    member,
    departments,
  };
}

/* =========================================================
 * PAGE
 * ======================================================= */

export default async function MemberPage({
  params,
}: MemberPageProps) {
  const { id } = await params;

  /* =======================================================
   * Everything that can run together starts together.
   *
   * This improves page-load performance because we are not
   * waiting for one query/API call before starting another.
   * ===================================================== */

  const [
    memberContext,
    work,
    attendance,
    leaveRequests,
    zohoRelationship,
  ] = await Promise.all([
    getMember(id),

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

  /* =======================================================
   * MEMBER NOT FOUND
   * ===================================================== */

  if (!memberContext) {
    notFound();
  }

  const {
    member,
    departments: memberDepartments,
  } = memberContext;

  /* =======================================================
   * MEMBER DEPARTMENT TEXT
   * ===================================================== */

  const departmentNames =
    memberDepartments.map(
      (department) =>
        department.name,
    );

  /* =======================================================
   * ZOHO PROJECT RELATIONSHIP
   *
   * Zoho Projects remains the source of truth for which
   * projects a member actually works on.
   *
   * If Zoho relationship data is READY:
   * only projects mapped to this member are shown in the
   * weekly planner.
   *
   * If Zoho is unavailable:
   * fall back to the current local project relationships.
   * ===================================================== */

  const zohoLocalProjectIds =
    new Set(
      zohoRelationship.status ===
        'READY'
        && zohoRelationship.data
        ? zohoRelationship.data.projects
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
    zohoRelationship.status ===
      'READY'
    && Boolean(
      zohoRelationship.data,
    );

  /* =======================================================
   * FILTER WORK PROJECTS
   * ===================================================== */

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

  /* =======================================================
   * COUNTS FOR ACCORDION HEADINGS
   * ===================================================== */

  const zohoProjectCount =
    zohoRelationship.status ===
      'READY'
      && zohoRelationship.data
      ? zohoRelationship.data
          .projects.length
      : null;

  const workProjectCount =
    filteredWork.projects.length;

  const taskCount =
    filteredWork.tasks.length;

  const weekGoalCount =
    filteredWork.weekGoals.length;

  /* =======================================================
   * RENDER
   * ===================================================== */

  return (
    <Layout>
      {/* =================================================
       * MEMBER HEADER
       * =============================================== */}

      <div className="mb-6">
        <div
          className="
            rounded-2xl
            border
            border-slate-200
            bg-white
            px-5
            py-5
            shadow-sm
            sm:px-6
          "
        >
          <div
            className="
              flex
              flex-col
              gap-4
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >
            <div className="min-w-0">
              <p
                className="
                  text-xs
                  font-semibold
                  uppercase
                  tracking-wide
                  text-blue-600
                "
              >
                Member Work Plan
              </p>

              <h1
                className="
                  mt-1
                  truncate
                  text-2xl
                  font-bold
                  text-slate-900
                "
              >
                {member.name}
              </h1>

              <div
                className="
                  mt-2
                  flex
                  flex-wrap
                  items-center
                  gap-x-2
                  gap-y-1
                  text-sm
                  text-slate-500
                "
              >
                <span>
                  {member.role}
                </span>

                <span className="text-slate-300">
                  •
                </span>

                <span>
                  {departmentNames.join(
                    ', ',
                  ) || 'Unassigned'}
                </span>

                <span className="text-slate-300">
                  •
                </span>

                <span>
                  {member.team ||
                    'No team'}
                </span>
              </div>
            </div>

            {/* ===========================================
             * Small status
             * ========================================= */}

            <span
              className={`
                inline-flex
                w-fit
                items-center
                gap-2
                rounded-full
                px-3
                py-1.5
                text-xs
                font-semibold
                ${
                  member.isActive !== false
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }
              `}
            >
              <span
                className={`
                  h-2
                  w-2
                  rounded-full
                  ${
                    member.isActive !== false
                      ? 'bg-emerald-500'
                      : 'bg-slate-400'
                  }
                `}
              />

              {member.isActive !== false
                ? 'Active Member'
                : 'Inactive Member'}
            </span>
          </div>

          {/* ===========================================
           * Quick stats
           * ========================================= */}

          <div
            className="
              mt-5
              grid
              grid-cols-2
              gap-3
              border-t
              border-slate-100
              pt-5
              sm:grid-cols-4
            "
          >
            <div
              className="
                rounded-xl
                bg-slate-50
                px-4
                py-3
              "
            >
              <p
                className="
                  text-xs
                  font-medium
                  text-slate-500
                "
              >
                Projects
              </p>

              <p
                className="
                  mt-1
                  text-xl
                  font-bold
                  text-slate-900
                "
              >
                {workProjectCount}
              </p>
            </div>

            <div
              className="
                rounded-xl
                bg-slate-50
                px-4
                py-3
              "
            >
              <p
                className="
                  text-xs
                  font-medium
                  text-slate-500
                "
              >
                Week Goals
              </p>

              <p
                className="
                  mt-1
                  text-xl
                  font-bold
                  text-slate-900
                "
              >
                {weekGoalCount}
              </p>
            </div>

            <div
              className="
                rounded-xl
                bg-slate-50
                px-4
                py-3
              "
            >
              <p
                className="
                  text-xs
                  font-medium
                  text-slate-500
                "
              >
                Tasks
              </p>

              <p
                className="
                  mt-1
                  text-xl
                  font-bold
                  text-slate-900
                "
              >
                {taskCount}
              </p>
            </div>

            <div
              className="
                rounded-xl
                bg-slate-50
                px-4
                py-3
              "
            >
              <p
                className="
                  text-xs
                  font-medium
                  text-slate-500
                "
              >
                Zoho Projects
              </p>

              <p
                className="
                  mt-1
                  text-xl
                  font-bold
                  text-slate-900
                "
              >
                {zohoProjectCount ??
                  '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================
       * ACCORDION SECTIONS
       *
       * Only Work Plan is opened initially.
       *
       * This prevents a very long page when members have
       * many projects/tasks/attendance records.
       * =============================================== */}

      <div className="space-y-4">
        {/* ===============================================
         * ZOHO PROJECTS
         * ============================================= */}

        <AccordionSection
          title={
            zohoProjectCount !== null
              ? `Zoho Projects (${zohoProjectCount})`
              : 'Zoho Projects'
          }
          description="
            Projects and assignments coming from Zoho Projects.
          "
        >
          <ZohoMemberProjectsPanel
            state={
              zohoRelationship
            }
          />
        </AccordionSection>

        {/* ===============================================
         * ATTENDANCE
         * ============================================= */}

        <AccordionSection
          title="Attendance & Leave"
          description="
            Attendance summary, availability and leave records.
          "
        >
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
        </AccordionSection>

        {/* ===============================================
         * WORK PLAN
         *
         * Open by default because this is the primary
         * purpose of the member details page.
         * ============================================= */}

        <AccordionSection
          title={`Work Plan & Tasks (${taskCount})`}
          description={`${workProjectCount} project${
            workProjectCount === 1
              ? ''
              : 's'
          } · ${weekGoalCount} weekly goal${
            weekGoalCount === 1
              ? ''
              : 's'
          } · ${taskCount} task${
            taskCount === 1
              ? ''
              : 's'
          }`}
          defaultOpen
        >
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
        </AccordionSection>
      </div>
    </Layout>
  );
}