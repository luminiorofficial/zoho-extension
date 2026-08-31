import 'server-only';

import type { QueryResultRow } from 'pg';

import { getCapacityStatus } from '@/lib/capacity';
import { availabilityStatusLabel } from '@/lib/attendance-utils';
import { db } from '@/lib/db';
import { getUnifiedWorkReport } from '@/lib/unified-work-report';
import { MEMBER_WORKLOAD_QUERY } from '@/lib/workload-query';
import type { MemberKeyAssignmentCounts, MemberWorkload, ProjectAllocation, ProjectStatus } from '@/types';

interface WorkloadRow extends QueryResultRow {
  member_id: string;
  member_name: string;
  email: string | null;
  role_title: string | null;
  department_ids: string[];
  department_names: string[];
  active_project_count: number;
  open_task_count: number;
  due_this_week_task_count: number;
  completed_this_week_task_count: number;
  overdue_task_count: number;
  availability_status: string;
  active_projects: {
    id: string;
    name: string;
    jobCode: string | null;
    status: string;
    deadline: string | null;
  }[];
}

const projectStatusLabels: Record<string, ProjectStatus> = {
  ACTIVE: 'Active',
  INTERNAL_REVIEW: 'Internal Review',
  CLIENT_REVIEW: 'Client Review',
  CLOSURE_PENDING: 'Closure Pending',
};

function mapAllocation(project: WorkloadRow['active_projects'][number]): ProjectAllocation {
  return {
    id: project.id,
    name: project.name,
    jobCode: project.jobCode ?? undefined,
    status: projectStatusLabels[project.status] ?? 'Active',
    deadline: project.deadline ?? undefined,
  };
}

function emptyKeyAssignmentCounts(): MemberKeyAssignmentCounts {
  return { total: 0, notStarted: 0, inProgress: 0, done: 0, onHold: 0, cancelled: 0, overdue: 0 };
}

async function getKeyAssignmentCountsByMember(): Promise<Map<string, MemberKeyAssignmentCounts>> {
  const report = await getUnifiedWorkReport();
  const today = new Date().toISOString().slice(0, 10);
  const countsByMember = new Map<string, MemberKeyAssignmentCounts>();

  for (const item of report) {
    const counts = countsByMember.get(item.member.id) ?? emptyKeyAssignmentCounts();
    counts.total += 1;
    switch (item.status) {
      case 'Not Started': counts.notStarted += 1; break;
      case 'In Progress': counts.inProgress += 1; break;
      case 'Done': counts.done += 1; break;
      case 'On Hold': counts.onHold += 1; break;
      case 'Cancelled': counts.cancelled += 1; break;
    }
    if (item.status !== 'Done' && item.status !== 'Cancelled' && item.endDate < today) {
      counts.overdue += 1;
    }
    countsByMember.set(item.member.id, counts);
  }

  return countsByMember;
}

export async function getMemberWorkloads(memberIds?: string[]): Promise<MemberWorkload[]> {
  const [result, keyAssignmentCountsByMember] = await Promise.all([
    db.query<WorkloadRow>(MEMBER_WORKLOAD_QUERY, [memberIds?.length ? memberIds : null]),
    getKeyAssignmentCountsByMember(),
  ]);

  return result.rows.map((row) => {
    const metrics = {
      activeProjectCount: Number(row.active_project_count),
      openTaskCount: Number(row.open_task_count),
      dueThisWeekTaskCount: Number(row.due_this_week_task_count),
      overdueTaskCount: Number(row.overdue_task_count),
    };

    return {
      memberId: row.member_id,
      memberName: row.member_name,
      email: row.email ?? '—',
      role: row.role_title ?? '—',
      departmentIds: row.department_ids,
      departmentNames: row.department_names,
      ...metrics,
      completedThisWeekTaskCount: Number(row.completed_this_week_task_count),
      capacityStatus: getCapacityStatus(metrics),
      availabilityStatus: availabilityStatusLabel(row.availability_status),
      activeProjects: row.active_projects.map(mapAllocation),
      keyAssignmentCounts: keyAssignmentCountsByMember.get(row.member_id) ?? emptyKeyAssignmentCounts(),
    };
  });
}
