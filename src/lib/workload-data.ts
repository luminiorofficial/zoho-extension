import 'server-only';

import type { QueryResultRow } from 'pg';

import { getCapacityStatus } from '@/lib/capacity';
import { availabilityStatusLabel } from '@/lib/attendance-utils';
import { db } from '@/lib/db';
import { MEMBER_WORKLOAD_QUERY } from '@/lib/workload-query';
import type { MemberWorkload, ProjectAllocation, ProjectStatus } from '@/types';

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

export async function getMemberWorkloads(memberIds?: string[]): Promise<MemberWorkload[]> {
  const result = await db.query<WorkloadRow>(MEMBER_WORKLOAD_QUERY, [memberIds?.length ? memberIds : null]);

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
    };
  });
}
