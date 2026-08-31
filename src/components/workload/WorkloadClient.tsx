'use client';

import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import AttendanceStatusBadge from '@/components/attendance/AttendanceStatusBadge';
import {
  FilterToolbar,
  ManagementKpiRow,
  ManagementPageHeader,
  ProgressSummary,
  ToolbarField,
  TruncatedText,
  compactFieldClass,
} from '@/components/management/ManagementUI';
import CapacityBadge from '@/components/workload/CapacityBadge';
import { CAPACITY_STATUSES, type CapacityStatus, type MemberWorkload } from '@/types';

interface WorkloadClientProps {
  workloads: MemberWorkload[];
  departments: { id: string; name: string }[];
}

function formatDate(value?: string): string {
  if (!value) return 'No deadline';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

function completion(workload: MemberWorkload): number {
  const measurable = workload.keyAssignmentCounts.total - workload.keyAssignmentCounts.cancelled;
  return measurable ? Math.round((workload.keyAssignmentCounts.done / measurable) * 100) : 0;
}

export default function WorkloadClient({ workloads, departments }: WorkloadClientProps) {
  const [departmentId, setDepartmentId] = useState('');
  const [capacityStatus, setCapacityStatus] = useState<CapacityStatus | ''>('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const filtered = useMemo(() => workloads.filter((workload) => (
    (!departmentId || workload.departmentIds.includes(departmentId))
    && (!capacityStatus || workload.capacityStatus === capacityStatus)
  )), [capacityStatus, departmentId, workloads]);
  const statusCounts = Object.fromEntries(CAPACITY_STATUSES.map((status) => [status, workloads.filter((workload) => workload.capacityStatus === status).length])) as Record<CapacityStatus, number>;

  function toggle(memberId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(memberId)) next.delete(memberId); else next.add(memberId);
      return next;
    });
  }

  return (
    <>
      <ManagementPageHeader eyebrow="Management" title="Workload" meta="Live capacity, availability, and assignment pressure by member." />
      <ManagementKpiRow items={[
        { label: 'Available', value: statusCounts.Available, tone: 'green' },
        { label: 'Normal', value: statusCounts.Normal, tone: 'blue' },
        { label: 'Busy', value: statusCounts.Busy, tone: 'amber' },
        { label: 'Overloaded', value: statusCounts.Overloaded, tone: statusCounts.Overloaded ? 'red' : 'slate' },
        { label: 'Active Projects', value: workloads.reduce((total, item) => total + item.activeProjectCount, 0), tone: 'blue' },
        { label: 'Overdue Tasks', value: workloads.reduce((total, item) => total + item.overdueTaskCount + item.keyAssignmentCounts.overdue, 0), tone: 'red' },
      ]} />
      <FilterToolbar>
        <ToolbarField label="Department" className="max-w-xs"><select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} className={compactFieldClass}><option value="">All departments</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></ToolbarField>
        <ToolbarField label="Capacity" className="max-w-xs"><select value={capacityStatus} onChange={(event) => setCapacityStatus(event.target.value as CapacityStatus | '')} className={compactFieldClass}><option value="">All capacity statuses</option>{CAPACITY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></ToolbarField>
        <span className="pb-2 text-xs font-semibold text-slate-500">{filtered.length} member{filtered.length === 1 ? '' : 's'}</span>
      </FilterToolbar>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="max-h-[68vh] overflow-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-100 text-xs font-bold uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_#e2e8f0]"><tr><th className="w-10 px-3 py-2.5"><span className="sr-only">Expand</span></th><th className="px-3 py-2.5">Member</th><th className="px-3 py-2.5">Department</th><th className="px-3 py-2.5">Active Projects</th><th className="px-3 py-2.5">Active Tasks</th><th className="px-3 py-2.5">Overdue</th><th className="px-3 py-2.5">Capacity</th><th className="px-3 py-2.5">Progress</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((workload) => {
                const isExpanded = expanded.has(workload.memberId);
                const overdue = workload.overdueTaskCount + workload.keyAssignmentCounts.overdue;
                return (
                  <Fragment key={workload.memberId}>
                    <tr className="cursor-pointer hover:bg-slate-50" onClick={() => toggle(workload.memberId)} aria-expanded={isExpanded}>
                      <td className="px-3 py-2.5 text-slate-400">{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                      <td className="px-3 py-2.5"><Link href={`/members/${workload.memberId}`} onClick={(event) => event.stopPropagation()} className="font-semibold text-blue-700 hover:underline"><TruncatedText>{workload.memberName}</TruncatedText></Link><TruncatedText className="text-xs text-slate-500">{workload.role}</TruncatedText></td>
                      <td className="px-3 py-2.5"><TruncatedText>{workload.departmentNames.join(', ') || 'Unassigned'}</TruncatedText></td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800">{workload.activeProjectCount}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800">{workload.openTaskCount + workload.keyAssignmentCounts.notStarted + workload.keyAssignmentCounts.inProgress + workload.keyAssignmentCounts.onHold}</td>
                      <td className={`px-3 py-2.5 font-semibold ${overdue ? 'text-red-600' : 'text-slate-700'}`}>{overdue}</td>
                      <td className="px-3 py-2.5"><CapacityBadge status={workload.capacityStatus} /></td>
                      <td className="px-3 py-2.5"><ProgressSummary value={completion(workload)} /></td>
                    </tr>
                    {isExpanded && <tr className="bg-slate-50/70"><td colSpan={8} className="px-4 py-4"><div className="grid gap-4 lg:grid-cols-[220px_1fr]"><div><p className="mb-2 text-xs font-bold uppercase text-slate-400">Availability</p><AttendanceStatusBadge status={workload.availabilityStatus} /><dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-slate-500">Due this week</dt><dd className="font-bold text-slate-800">{workload.dueThisWeekTaskCount}</dd></div><div><dt className="text-slate-500">Done this week</dt><dd className="font-bold text-slate-800">{workload.completedThisWeekTaskCount}</dd></div></dl></div><div><p className="mb-2 text-xs font-bold uppercase text-slate-400">Current project allocation</p>{workload.activeProjects.length ? <div className="flex flex-wrap gap-2">{workload.activeProjects.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:border-blue-300 hover:bg-blue-50"><span className="font-semibold text-slate-800">{project.jobCode ? `${project.jobCode} · ` : ''}{project.name}</span><span className="ml-2 text-xs text-slate-500">{project.status} · {formatDate(project.deadline)}</span></Link>)}</div> : <p className="text-sm text-slate-500">No active project allocation.</p>}</div></div></td></tr>}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {!filtered.length && <p className="px-4 py-10 text-center text-sm text-slate-500">No members match these filters.</p>}
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">Capacity uses the strongest pressure signal from active projects, open work, work due this week, and overdue tasks. Expand a member row for availability and project allocation.</p>
    </>
  );
}
