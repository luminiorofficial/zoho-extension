'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import AssignmentHierarchy from '@/components/assignments/AssignmentHierarchy';
import type { KeyAssignmentReportOptions } from '@/lib/key-assignment-data';
import type { KeyAssignment, KeyAssignmentFilters } from '@/types';

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
  const subGoals = useMemo(() => options.subGoals.filter((subGoal) => (
    !selectedKeyId || subGoal.keyId === selectedKeyId
  )), [options.subGoals, selectedKeyId]);

  return (
    <>
      <form method="GET" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">Department<select name="departmentId" defaultValue={filters.departmentId ?? ''} className={fieldClass}><option value="">All departments</option>{options.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Project<select name="projectId" defaultValue={filters.projectId ?? ''} className={fieldClass}><option value="">All projects</option>{options.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Member<select name="memberId" defaultValue={filters.memberId ?? ''} className={fieldClass}><option value="">All members</option>{options.members.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Key<select name="keyId" value={selectedKeyId} onChange={(event) => setSelectedKeyId(event.target.value)} className={fieldClass}><option value="">All keys</option>{options.keys.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Sub Goal<select name="subGoalId" defaultValue={filters.subGoalId ?? ''} className={fieldClass}><option value="">All sub goals</option>{subGoals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Task<select name="taskId" defaultValue={filters.taskId ?? ''} className={fieldClass}><option value="">All tasks</option>{options.tasks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Status<select name="status" defaultValue={filters.status ?? ''} className={fieldClass}><option value="">All statuses</option><option>Not Started</option><option>In Progress</option><option>Done</option><option>On Hold</option><option>Cancelled</option></select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-slate-700">From<input name="startDate" type="date" defaultValue={filters.startDate ?? ''} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700">To<input name="endDate" type="date" defaultValue={filters.endDate ?? ''} className={fieldClass} /></label>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <p className="text-sm text-slate-500">Date filters include assignments whose date range overlaps the selected range.</p>
          <div className="flex gap-3"><Link href="/reports" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Clear</Link><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Apply Filters</button></div>
        </div>
      </form>

      <section className="mt-8">
        <div className="mb-4"><h2 className="text-lg font-semibold text-slate-900">Assignments ({assignments.length})</h2><p className="mt-1 text-sm text-slate-500">Read-only data from the same Work Planning assignments.</p></div>
        <AssignmentHierarchy assignments={assignments} view="report" />
      </section>
    </>
  );
}
