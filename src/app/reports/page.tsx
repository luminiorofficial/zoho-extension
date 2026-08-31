import { Layout } from '@/components';
import AssignmentReportsClient from '@/components/reports/AssignmentReportsClient';
import { getKeyAssignmentReportOptions, toKeyAssignment } from '@/lib/key-assignment-data';
import { isDate, isUuid } from '@/lib/planner-validation';
import { getUnifiedWorkReport } from '@/lib/unified-work-report';
import type { KeyAssignmentFilters, KeyAssignmentStatus } from '@/types';

export const dynamic = 'force-dynamic';

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

const statuses = new Set<KeyAssignmentStatus>([
  'Not Started', 'In Progress', 'Done', 'On Hold', 'Cancelled',
]);

function statusValue(value: string | undefined): KeyAssignmentStatus | undefined {
  return value && statuses.has(value as KeyAssignmentStatus)
    ? value as KeyAssignmentStatus
    : undefined;
}

export default async function ReportsPage({ searchParams }: PageProps<'/reports'>) {
  const query = await searchParams;
  const teamId = one(query.teamId)?.trim() || undefined;
  const departmentId = one(query.departmentId);
  const projectId = one(query.projectId);
  const memberId = one(query.memberId);
  const keyId = one(query.keyId);
  const subGoalId = one(query.subGoalId);
  const taskId = one(query.taskId);
  const startDate = one(query.startDate);
  const endDate = one(query.endDate);
  const filters: KeyAssignmentFilters = {
    teamId,
    departmentId: isUuid(departmentId) ? departmentId : undefined,
    projectId: isUuid(projectId) ? projectId : undefined,
    memberId: isUuid(memberId) ? memberId : undefined,
    keyId: isUuid(keyId) ? keyId : undefined,
    subGoalId: isUuid(subGoalId) ? subGoalId : undefined,
    taskId: isUuid(taskId) ? taskId : undefined,
    status: statusValue(one(query.status)),
    startDate: isDate(startDate) ? startDate : undefined,
    endDate: isDate(endDate) ? endDate : undefined,
  };

  const [report, options] = await Promise.all([
    getUnifiedWorkReport({
      ...filters,
      includeDailyStatuses: Boolean(filters.startDate && filters.endDate),
      dailyStatusStartDate: filters.startDate,
      dailyStatusEndDate: filters.endDate,
    }),
    getKeyAssignmentReportOptions(),
  ]);
  const assignments = report.map(toKeyAssignment);

  return (
    <Layout>
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-600">Management</p>
        <h1 className="mt-1 text-[1.65rem] font-bold leading-tight text-slate-950">Reports</h1>
        <p className="mt-1 text-sm text-slate-500">Assignment, member, and project performance from the unified Work Planning data.</p>
      </div>
      <AssignmentReportsClient
        key={[
          filters.teamId,
          filters.departmentId,
          filters.projectId,
          filters.memberId,
          filters.keyId,
          filters.subGoalId,
          filters.taskId,
          filters.status,
          filters.startDate,
          filters.endDate,
        ].join(':')}
        assignments={assignments}
        options={options}
        filters={filters}
      />
    </Layout>
  );
}
