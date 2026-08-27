import { Layout } from '@/components';
import AssignmentReportsClient from '@/components/reports/AssignmentReportsClient';
import { getKeyAssignmentReportOptions, getKeyAssignments } from '@/lib/key-assignment-data';
import { isDate, isUuid } from '@/lib/planner-validation';
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
  const departmentId = one(query.departmentId);
  const projectId = one(query.projectId);
  const memberId = one(query.memberId);
  const keyId = one(query.keyId);
  const subGoalId = one(query.subGoalId);
  const taskId = one(query.taskId);
  const startDate = one(query.startDate);
  const endDate = one(query.endDate);
  const filters: KeyAssignmentFilters = {
    departmentId: isUuid(departmentId) ? departmentId : undefined,
    projectId: isUuid(projectId) ? projectId : undefined,
    memberId: isUuid(memberId) ? memberId : undefined,
    keyId: isUuid(keyId) ? keyId : undefined,
    subGoalId: isUuid(subGoalId) ? subGoalId : undefined,
    taskId: isUuid(taskId) ? taskId : undefined,
    status: statusValue(one(query.status)),
    periodStart: isDate(startDate) ? startDate : undefined,
    periodEnd: isDate(endDate) ? endDate : undefined,
  };

  const [assignments, options] = await Promise.all([
    getKeyAssignments(filters),
    getKeyAssignmentReportOptions(),
  ]);

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Work Planning Reports</h1>
        <p className="mt-1 text-sm text-slate-500">Filter and review the same assignments saved on the Work Planning page.</p>
      </div>
      <AssignmentReportsClient
        key={[
          filters.departmentId,
          filters.projectId,
          filters.memberId,
          filters.keyId,
          filters.subGoalId,
          filters.taskId,
          filters.status,
          filters.periodStart,
          filters.periodEnd,
        ].join(':')}
        assignments={assignments}
        options={options}
        filters={filters}
      />
    </Layout>
  );
}
