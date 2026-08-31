'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BriefcaseBusiness, CalendarClock, CheckCircle2, CircleGauge } from 'lucide-react';

import CapacityBadge from '@/components/workload/CapacityBadge';
import AttendanceStatusBadge from '@/components/attendance/AttendanceStatusBadge';
import { CAPACITY_STATUSES, type CapacityStatus, type MemberWorkload } from '@/types';

interface WorkloadClientProps {
  workloads: MemberWorkload[];
  departments: { id: string; name: string }[];
}

function formatDate(value?: string): string {
  if (!value) return 'No deadline';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function isDeliveryMember(workload: MemberWorkload): boolean {
  return /operations|artist/i.test(`${workload.role} ${workload.departmentNames.join(' ')}`);
}

export default function WorkloadClient({ workloads, departments }: WorkloadClientProps) {
  const [departmentId, setDepartmentId] = useState('');
  const [capacityStatus, setCapacityStatus] = useState<CapacityStatus | ''>('');

  const filtered = useMemo(() => workloads.filter((workload) => (
    (!departmentId || workload.departmentIds.includes(departmentId))
    && (!capacityStatus || workload.capacityStatus === capacityStatus)
  )), [capacityStatus, departmentId, workloads]);

  const statusCounts = CAPACITY_STATUSES.map((status) => ({
    status,
    count: workloads.filter((workload) => workload.capacityStatus === status).length,
  }));

  return (
    <>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900">Artist Allocation &amp; Workload</h1>
        <p className="mt-1 text-sm text-slate-500">
          Live capacity and today&apos;s availability for safer project assignment.
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statusCounts.map(({ status, count }) => (
          <div key={status} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <CapacityBadge status={status} />
              <span className="text-2xl font-bold text-slate-900">{count}</span>
            </div>
            <p className="mt-3 text-xs text-slate-500">member{count === 1 ? '' : 's'}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Department
          <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
            <option value="">All departments</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Capacity status
          <select value={capacityStatus} onChange={(event) => setCapacityStatus(event.target.value as CapacityStatus | '')} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
            <option value="">All capacity statuses</option>
            {CAPACITY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
      </div>

      <p className="mb-4 text-sm text-slate-500">{filtered.length} member{filtered.length === 1 ? '' : 's'}</p>

      <div className="space-y-5">
        {filtered.map((workload) => {
          const deliveryMember = isDeliveryMember(workload);
          return (
            <article key={workload.memberId} className={`rounded-xl border bg-white p-5 ${deliveryMember ? 'border-indigo-200 shadow-sm' : 'border-slate-200'}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/members/${workload.memberId}`} className="font-semibold text-slate-900 hover:text-blue-700">{workload.memberName}</Link>
                    <CapacityBadge status={workload.capacityStatus} />
                    <AttendanceStatusBadge status={workload.availabilityStatus} />
                    {deliveryMember && <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">Operations / Artist allocation</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{workload.role} · {workload.departmentNames.join(', ') || 'Unassigned'}</p>
                </div>
                {workload.overdueTaskCount > 0 && (
                  <span className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    {workload.overdueTaskCount} overdue open task{workload.overdueTaskCount === 1 ? '' : 's'}
                  </span>
                )}
                {workload.keyAssignmentCounts.overdue > 0 && (
                  <span className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    {workload.keyAssignmentCounts.overdue} overdue key assignment{workload.keyAssignmentCounts.overdue === 1 ? '' : 's'}
                  </span>
                )}
                {['Absent', 'Approved Leave'].includes(workload.availabilityStatus) && (
                  <span className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    Unavailable today — avoid new assignments
                  </span>
                )}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3"><p className="flex items-center gap-1.5 text-xs text-slate-500"><BriefcaseBusiness size={14} /> Active projects</p><p className="mt-1 text-xl font-bold text-slate-900">{workload.activeProjectCount}</p></div>
                <div className="rounded-lg bg-slate-50 p-3"><p className="flex items-center gap-1.5 text-xs text-slate-500"><CircleGauge size={14} /> Open tasks</p><p className="mt-1 text-xl font-bold text-slate-900">{workload.openTaskCount}</p></div>
                <div className="rounded-lg bg-slate-50 p-3"><p className="flex items-center gap-1.5 text-xs text-slate-500"><CalendarClock size={14} /> Due this week</p><p className="mt-1 text-xl font-bold text-slate-900">{workload.dueThisWeekTaskCount}</p></div>
                <div className="rounded-lg bg-slate-50 p-3"><p className="flex items-center gap-1.5 text-xs text-slate-500"><CheckCircle2 size={14} /> Completed this week</p><p className="mt-1 text-xl font-bold text-slate-900">{workload.completedThisWeekTaskCount}</p></div>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Key assignment workload</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <Link href={`/members/${workload.memberId}`} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100">
                    {workload.keyAssignmentCounts.total} total
                  </Link>
                  {workload.keyAssignmentCounts.notStarted > 0 && <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-zinc-700">{workload.keyAssignmentCounts.notStarted} not started</span>}
                  {workload.keyAssignmentCounts.inProgress > 0 && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">{workload.keyAssignmentCounts.inProgress} in progress</span>}
                  {workload.keyAssignmentCounts.done > 0 && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{workload.keyAssignmentCounts.done} done</span>}
                  {workload.keyAssignmentCounts.onHold > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{workload.keyAssignmentCounts.onHold} on hold</span>}
                  {workload.keyAssignmentCounts.cancelled > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">{workload.keyAssignmentCounts.cancelled} cancelled</span>}
                  {workload.keyAssignmentCounts.total === 0 && <span className="text-slate-500">No key assignments yet.</span>}
                </div>
              </div>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current project allocation</p>
                {workload.activeProjects.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {workload.activeProjects.map((project) => (
                      <Link key={project.id} href={`/projects/${project.id}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm hover:border-blue-300 hover:bg-blue-50">
                        <span className="font-medium text-slate-800">{project.jobCode ? `${project.jobCode} · ` : ''}{project.name}</span>
                        <span className="ml-2 text-xs text-slate-500">{project.status} · {formatDate(project.deadline)}</span>
                      </Link>
                    ))}
                  </div>
                ) : <p className="mt-2 text-sm text-slate-500">No active project allocation.</p>}
              </div>
            </article>
          );
        })}
      </div>

      {!filtered.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-500">No members match these filters.</div>}

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
        Capacity uses the strongest pressure signal. Three active projects is Busy; more than three is Overloaded. High open, due-this-week, or overdue task counts can also raise capacity. Completed-this-week counts Done tasks dated in the current Monday–Sunday week.
      </div>
    </>
  );
}
