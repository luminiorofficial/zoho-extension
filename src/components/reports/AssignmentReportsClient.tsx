'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import AssignmentHierarchy from '@/components/assignments/AssignmentHierarchy';
import { ASSIGNMENT_STATUS_OPTIONS } from '@/lib/assignment-status';
import { todayInIndia } from '@/lib/assignment-tracker-periods';
import type { KeyAssignmentReportOptions } from '@/lib/key-assignment-data';
import { reportingPeriod, type ReportPeriodType } from '@/lib/reporting-periods';
import type { KeyAssignment, KeyAssignmentFilters, KeyAssignmentStatusCode } from '@/types';

const fieldClass = 'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function AssignmentReportsClient({
  assignments,
  options,
  filters,
}: {
  assignments: KeyAssignment[];
  options: KeyAssignmentReportOptions;
  filters: KeyAssignmentFilters;
}) {
  const [selectedKeyId, setSelectedKeyId] = useState(filters.keyId ?? '');
  const [startDate, setStartDate] = useState(filters.startDate ?? '');
  const [endDate, setEndDate] = useState(filters.endDate ?? '');
  const subGoals = useMemo(() => options.subGoals.filter((subGoal) => (
    !selectedKeyId || subGoal.keyId === selectedKeyId
  )), [options.subGoals, selectedKeyId]);
  const dailySummary = useMemo(() => {
    const counts = Object.fromEntries(ASSIGNMENT_STATUS_OPTIONS.map((option) => [option.code, 0])) as Record<KeyAssignmentStatusCode, number>;
    for (const assignment of assignments) {
      for (const record of assignment.dailyStatuses ?? []) counts[record.status] += 1;
    }
    return counts;
  }, [assignments]);
  const dailyRecordCount = Object.values(dailySummary).reduce((total, count) => total + count, 0);

  function choosePeriod(type: Exclude<ReportPeriodType, 'YEARLY'>) {
    const period = reportingPeriod(type, todayInIndia());
    if (!period) return;
    setStartDate(period.start);
    setEndDate(period.end);
  }

  return (
    <>
      <form method="GET" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Report period</span>
          <button type="button" onClick={() => choosePeriod('WEEKLY')} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Weekly</button>
          <button type="button" onClick={() => choosePeriod('MONTHLY')} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Monthly</button>
          <button type="button" onClick={() => choosePeriod('QUARTERLY')} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Quarterly</button>
          <button type="button" onClick={() => { setStartDate(''); setEndDate(''); }} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Custom / Clear</button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">Team<select name="teamId" defaultValue={filters.teamId ?? ''} className={fieldClass}><option value="">All teams</option>{options.teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Department<select name="departmentId" defaultValue={filters.departmentId ?? ''} className={fieldClass}><option value="">All departments</option>{options.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Project<select name="projectId" defaultValue={filters.projectId ?? ''} className={fieldClass}><option value="">All projects</option>{options.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Member<select name="memberId" defaultValue={filters.memberId ?? ''} className={fieldClass}><option value="">All members</option>{options.members.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Key<select name="keyId" value={selectedKeyId} onChange={(event) => setSelectedKeyId(event.target.value)} className={fieldClass}><option value="">All keys</option>{options.keys.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Sub Goal<select name="subGoalId" defaultValue={filters.subGoalId ?? ''} className={fieldClass}><option value="">All sub goals</option>{subGoals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Task<select name="taskId" defaultValue={filters.taskId ?? ''} className={fieldClass}><option value="">All tasks</option>{options.tasks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Overall Status<select name="status" defaultValue={filters.status ?? ''} className={fieldClass}><option value="">All statuses</option><option>Not Started</option><option>In Progress</option><option>Done</option><option>On Hold</option><option>Cancelled</option></select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-slate-700">From<input name="startDate" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700">To<input name="endDate" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={fieldClass} /></label>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <p className="text-sm text-slate-500">Date filters include assignments whose date range overlaps the selected range.</p>
          <div className="flex gap-3"><Link href="/reports" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Clear</Link><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Apply Filters</button></div>
        </div>
      </form>

      {filters.startDate && filters.endDate && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Daily Execution Summary</h2><p className="mt-1 text-sm text-slate-500">Recorded daily statuses in the selected report range. Missing days are not inferred in Reports.</p></div><span className="text-xs font-medium text-slate-500">{dailyRecordCount} recorded day{dailyRecordCount === 1 ? '' : 's'}</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {ASSIGNMENT_STATUS_OPTIONS.map((option) => <div key={option.code} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs font-medium text-slate-500">{option.label}</p><p className="mt-1 text-xl font-bold text-slate-900">{dailySummary[option.code]}</p></div>)}
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="mb-4"><h2 className="text-lg font-semibold text-slate-900">Assignments ({assignments.length})</h2><p className="mt-1 text-sm text-slate-500">Read-only data from the same Work Planning assignments.</p></div>
        <AssignmentHierarchy assignments={assignments} />
      </section>
    </>
  );
}
