'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import AssignmentHierarchy from '@/components/assignments/AssignmentHierarchy';
import {
  CompactDataTable,
  DetailDrawer,
  FilterToolbar,
  ManagementKpiRow,
  ProgressSummary,
  SectionHeading,
  ToolbarField,
  TruncatedText,
  compactFieldClass,
} from '@/components/management/ManagementUI';
import { ASSIGNMENT_STATUS_OPTIONS } from '@/lib/assignment-status';
import { todayInIndia } from '@/lib/assignment-tracker-periods';
import type { KeyAssignmentReportOptions } from '@/lib/key-assignment-data';
import { assignmentMetrics, groupAssignments, uniqueCount } from '@/lib/management-metrics';
import { reportingPeriod, type ReportPeriodType } from '@/lib/reporting-periods';
import type { KeyAssignment, KeyAssignmentFilters, KeyAssignmentStatusCode } from '@/types';

type PeriodChoice = ReportPeriodType | 'CUSTOM';

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
  const [period, setPeriod] = useState<PeriodChoice>('CUSTOM');
  const [selectedGroup, setSelectedGroup] = useState<{ title: string; assignments: KeyAssignment[] }>();
  const today = todayInIndia();
  const metrics = useMemo(() => assignmentMetrics(assignments, today), [assignments, today]);
  const memberGroups = useMemo(() => groupAssignments(assignments, (item) => item.memberId), [assignments]);
  const projectGroups = useMemo(() => groupAssignments(assignments, (item) => item.projectId), [assignments]);
  const subGoals = useMemo(() => options.subGoals.filter((subGoal) => !selectedKeyId || subGoal.keyId === selectedKeyId), [options.subGoals, selectedKeyId]);
  const dailySummary = useMemo(() => {
    const counts = Object.fromEntries(ASSIGNMENT_STATUS_OPTIONS.map((option) => [option.code, 0])) as Record<KeyAssignmentStatusCode, number>;
    for (const assignment of assignments) for (const record of assignment.dailyStatuses ?? []) counts[record.status] += 1;
    return counts;
  }, [assignments]);

  function choosePeriod(type: PeriodChoice) {
    setPeriod(type);
    if (type === 'CUSTOM') return;
    const next = reportingPeriod(type, today);
    if (next) { setStartDate(next.start); setEndDate(next.end); }
  }

  return (
    <>
      <form method="GET">
        <div className="mb-3 flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5" aria-label="Report period">
          {([
            ['WEEKLY', 'Weekly'], ['MONTHLY', 'Monthly'], ['QUARTERLY', 'Quarterly'], ['YEARLY', 'FY'], ['CUSTOM', 'Custom'],
          ] as [PeriodChoice, string][]).map(([id, label]) => <button key={id} type="button" onClick={() => choosePeriod(id)} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${period === id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}
          <span className="ml-auto px-2 text-xs text-slate-500">{startDate && endDate ? `${startDate} → ${endDate}` : 'All assignment dates'}</span>
        </div>

        <FilterToolbar actions={<><Link href="/reports" className="h-9 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Clear</Link><button className="h-9 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">Apply</button></>}>
          <ToolbarField label="Department"><select name="departmentId" defaultValue={filters.departmentId ?? ''} className={compactFieldClass}><option value="">All departments</option>{options.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></ToolbarField>
          <ToolbarField label="Member"><select name="memberId" defaultValue={filters.memberId ?? ''} className={compactFieldClass}><option value="">All members</option>{options.members.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></ToolbarField>
          <ToolbarField label="Project"><select name="projectId" defaultValue={filters.projectId ?? ''} className={compactFieldClass}><option value="">All projects</option>{options.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></ToolbarField>
          <ToolbarField label="Key"><select name="keyId" value={selectedKeyId} onChange={(event) => setSelectedKeyId(event.target.value)} className={compactFieldClass}><option value="">All keys</option>{options.keys.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></ToolbarField>
          <ToolbarField label="Status"><select name="status" defaultValue={filters.status ?? ''} className={compactFieldClass}><option value="">All statuses</option><option>Not Started</option><option>In Progress</option><option>Done</option><option>On Hold</option><option>Cancelled</option></select></ToolbarField>
        </FilterToolbar>

        <details className="-mt-2 mb-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-600">More filters and custom dates</summary>
          <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 md:grid-cols-2 xl:grid-cols-5">
            <ToolbarField label="Team"><select name="teamId" defaultValue={filters.teamId ?? ''} className={compactFieldClass}><option value="">All teams</option>{options.teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></ToolbarField>
            <ToolbarField label="Sub Goal"><select name="subGoalId" defaultValue={filters.subGoalId ?? ''} className={compactFieldClass}><option value="">All sub goals</option>{subGoals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></ToolbarField>
            <ToolbarField label="Task"><select name="taskId" defaultValue={filters.taskId ?? ''} className={compactFieldClass}><option value="">All tasks</option>{options.tasks.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></ToolbarField>
            <ToolbarField label="From"><input name="startDate" type="date" value={startDate} onChange={(event) => { setPeriod('CUSTOM'); setStartDate(event.target.value); }} className={compactFieldClass} /></ToolbarField>
            <ToolbarField label="To"><input name="endDate" type="date" value={endDate} onChange={(event) => { setPeriod('CUSTOM'); setEndDate(event.target.value); }} className={compactFieldClass} /></ToolbarField>
          </div>
        </details>
      </form>

      <ManagementKpiRow items={[
        { label: 'Assignments', value: metrics.total, tone: 'blue' },
        { label: 'Done', value: metrics.done, tone: 'green' },
        { label: 'In Progress', value: metrics.inProgress, tone: 'blue' },
        { label: 'Not Started', value: metrics.notStarted, tone: 'slate' },
        { label: 'Overdue', value: metrics.overdue, tone: metrics.overdue ? 'red' : 'slate' },
        { label: 'Completion', value: `${metrics.completion}%`, tone: 'green' },
      ]} />

      {filters.startDate && filters.endDate && <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"><span className="font-semibold">Recorded daily execution:</span>{ASSIGNMENT_STATUS_OPTIONS.map((option) => <span key={option.code}>{option.label} <strong>{dailySummary[option.code]}</strong></span>)}</div>}

      <div className="grid gap-5 xl:grid-cols-2">
        <section><SectionHeading title="Member Performance" description="Select a row to inspect its assignments." /><CompactDataTable columns={[
          { key: 'member', header: 'Member', render: (rows: KeyAssignment[]) => <Link href={`/members/${rows[0].memberId}`} onClick={(event) => event.stopPropagation()} className="font-semibold text-blue-700 hover:underline"><TruncatedText>{rows[0].memberName}</TruncatedText></Link> },
          { key: 'done', header: 'Done', render: (rows: KeyAssignment[]) => assignmentMetrics(rows, today).done },
          { key: 'progress', header: 'In Progress', render: (rows: KeyAssignment[]) => assignmentMetrics(rows, today).inProgress },
          { key: 'overdue', header: 'Overdue', render: (rows: KeyAssignment[]) => <span className={assignmentMetrics(rows, today).overdue ? 'font-semibold text-red-600' : ''}>{assignmentMetrics(rows, today).overdue}</span> },
          { key: 'completion', header: 'Completion', render: (rows: KeyAssignment[]) => <ProgressSummary value={assignmentMetrics(rows, today).completion} /> },
        ]} rows={memberGroups} rowKey={(rows) => rows[0].memberId} onRowClick={(rows) => setSelectedGroup({ title: rows[0].memberName, assignments: rows })} /></section>
        <section><SectionHeading title="Project Performance" description="Project delivery status across the selected scope." /><CompactDataTable columns={[
          { key: 'project', header: 'Project', render: (rows: KeyAssignment[]) => <Link href={`/projects/${rows[0].projectId}`} onClick={(event) => event.stopPropagation()} className="font-semibold text-blue-700 hover:underline"><TruncatedText>{rows[0].projectName}</TruncatedText></Link> },
          { key: 'members', header: 'Members', render: (rows: KeyAssignment[]) => uniqueCount(rows, (row) => row.memberId) },
          { key: 'tasks', header: 'Tasks', render: (rows: KeyAssignment[]) => rows.length },
          { key: 'done', header: 'Done', render: (rows: KeyAssignment[]) => assignmentMetrics(rows, today).done },
          { key: 'overdue', header: 'Overdue', render: (rows: KeyAssignment[]) => assignmentMetrics(rows, today).overdue },
          { key: 'progress', header: 'Progress', render: (rows: KeyAssignment[]) => <ProgressSummary value={assignmentMetrics(rows, today).completion} /> },
        ]} rows={projectGroups} rowKey={(rows) => rows[0].projectId} onRowClick={(rows) => setSelectedGroup({ title: rows[0].projectName, assignments: rows })} /></section>
      </div>

      <details className="mt-5 rounded-lg border border-slate-200 bg-white">
        <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-800">Detailed assignment hierarchy ({assignments.length})</summary>
        <div className="border-t border-slate-200 p-3"><AssignmentHierarchy assignments={assignments} /></div>
      </details>

      {selectedGroup && <DetailDrawer title={selectedGroup.title} subtitle={`${selectedGroup.assignments.length} assignment${selectedGroup.assignments.length === 1 ? '' : 's'}`} onClose={() => setSelectedGroup(undefined)}><AssignmentHierarchy assignments={selectedGroup.assignments} /></DetailDrawer>}
    </>
  );
}
