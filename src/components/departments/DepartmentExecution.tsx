'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import ProgressBar from '@/components/common/ProgressBar';
import StatusBadge from '@/components/common/StatusBadge';
import AssignmentHierarchy from '@/components/assignments/AssignmentHierarchy';
import DailyWorkTracker from '@/components/assignments/DailyWorkTracker';
import {
  CompactDataTable,
  DetailDrawer,
  ManagementKpiRow,
  ManagementPageHeader,
  PageTabs,
  ProgressSummary,
  SectionHeading,
  TruncatedText,
  type CompactColumn,
} from '@/components/management/ManagementUI';
import { assignmentMetrics, groupAssignments, uniqueCount } from '@/lib/management-metrics';
import type { Department, Member, WeekGoal } from '@/types';
import type { KeyAssignment } from '@/types';

interface DepartmentExecutionProps {
  department: Department;
  members: Member[];
  weekGoals: WeekGoal[];
}

function formatWeek(start: string, end: string): string {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  return `${formatter.format(new Date(`${start}T00:00:00Z`))} – ${formatter.format(new Date(`${end}T00:00:00Z`))}`;
}

export default function DepartmentExecution({
  department,
  members,
  weekGoals,
}: DepartmentExecutionProps) {
  const memberNames = new Map(members.map((member) => [member.id, member.name]));

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Execution Flow</h2>
        <p className="mt-1 text-sm text-slate-500">
          Department → Goal → Action → Project → Member → Week Goal → Daily Task
        </p>
      </div>

      <div className="space-y-4">
        {department.goals.map((goal) => (
          <details key={goal.id} className="group rounded-xl border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Goal</p>
                <h3 className="mt-1 font-semibold text-slate-900">{goal.title}</h3>
              </div>
              <ChevronDown className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>

            <div className="space-y-4 border-t border-slate-100 p-5">
              {goal.actions.map((action) => (
                <div key={action.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Action</p>
                      <p className="mt-1 font-medium text-slate-800">
                        {action.code ? `${action.code} · ` : ''}{action.title}
                      </p>
                    </div>
                    <div className="w-36">
                      <div className="mb-1 text-right text-xs font-medium text-slate-500">
                        {Math.round(action.progress)}%
                      </div>
                      <ProgressBar value={action.progress} size="sm" />
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {action.assignedMemberIds.map((memberId) => {
                      const memberWeekGoals = weekGoals.filter(
                        (weekGoal) => weekGoal.actionId === action.id
                          && weekGoal.assignedMemberId === memberId,
                      );

                      return (
                        <div key={memberId} className="rounded-lg bg-slate-50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Member</p>
                              <Link
                                href={`/members/${memberId}`}
                                className="mt-1 inline-block text-sm font-semibold text-blue-700 hover:text-blue-800"
                              >
                                {memberNames.get(memberId) ?? 'Unknown member'}
                              </Link>
                            </div>
                            <span className="text-xs text-slate-500">
                              {memberWeekGoals.length} week goal{memberWeekGoals.length === 1 ? '' : 's'}
                            </span>
                          </div>

                          {memberWeekGoals.length ? (
                            <div className="mt-3 space-y-3">
                              {memberWeekGoals.map((weekGoal) => (
                                <div key={weekGoal.id} className="rounded-lg border border-slate-200 bg-white p-3">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                                        Week Goal · {formatWeek(weekGoal.weekStart, weekGoal.weekEnd)}
                                      </p>
                                      <p className="mt-1 text-sm font-medium text-slate-800">{weekGoal.title}</p>
                                      <p className="mt-1 text-xs text-slate-500">Project: {weekGoal.projectName}</p>
                                    </div>
                                    <span className="text-sm font-semibold text-slate-700">{Math.round(weekGoal.progress)}%</span>
                                  </div>

                                  <div className="mt-3 space-y-2">
                                    {weekGoal.tasks.map((task) => (
                                      <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                                        <div>
                                          <p className="text-sm text-slate-700">{task.title}</p>
                                          <p className="text-xs text-slate-400">Daily task · {task.taskDate}</p>
                                        </div>
                                        <StatusBadge status={task.status} size="sm" />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-slate-400">No weekly goals or daily tasks yet.</p>
                          )}
                        </div>
                      );
                    })}

                    {!action.assignedMemberIds.length && (
                      <p className="text-sm text-slate-400">No member assigned to this action.</p>
                    )}
                  </div>
                </div>
              ))}

              {!goal.actions.length && (
                <p className="text-sm text-slate-500">No actions recorded for this goal.</p>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

type DepartmentTab = 'overview' | 'members' | 'projects' | 'goals' | 'tracker' | 'reports' | 'execution';

export interface DepartmentMemberSummary {
  id: string;
  name: string;
  team: string | null;
  roleTitle: string | null;
  isActive: boolean;
}

export interface ManagementDepartment {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export function DepartmentManagementDashboard({
  department,
  members,
  assignments,
  initialToday,
}: {
  department: ManagementDepartment;
  members: DepartmentMemberSummary[];
  assignments: KeyAssignment[];
  initialToday: string;
}) {
  const [tab, setTab] = useState<DepartmentTab>('overview');
  const [selectedMember, setSelectedMember] = useState<DepartmentMemberSummary>();
  const metrics = useMemo(() => assignmentMetrics(assignments, initialToday), [assignments, initialToday]);
  const memberGroups = useMemo(() => new Map(groupAssignments(assignments, (item) => item.memberId).map((items) => [items[0].memberId, items])), [assignments]);
  const projectGroups = useMemo(() => groupAssignments(assignments, (item) => item.projectId), [assignments]);
  const goalGroups = useMemo(() => groupAssignments(assignments, (item) => `${item.keyId}:${item.subGoalId}`), [assignments]);
  const doneThisWeek = assignments.filter((item) => item.dailyStatuses?.some((record) => record.status === 'DONE')).length;

  const memberColumns: CompactColumn<DepartmentMemberSummary>[] = [
    { key: 'member', header: 'Member', render: (row) => <div><TruncatedText className="font-semibold text-slate-900">{row.name}</TruncatedText><TruncatedText className="text-xs text-slate-500">{row.roleTitle ?? 'Designation not set'}</TruncatedText></div> },
    { key: 'team', header: 'Team', render: (row) => row.team ?? '—' },
    { key: 'projects', header: 'Projects', render: (row) => uniqueCount(memberGroups.get(row.id) ?? [], (item) => item.projectId) },
    { key: 'open', header: 'Open Tasks', render: (row) => assignmentMetrics(memberGroups.get(row.id) ?? [], initialToday).active },
    { key: 'done', header: 'Done This Week', render: (row) => (memberGroups.get(row.id) ?? []).filter((item) => item.dailyStatuses?.some((record) => record.status === 'DONE')).length },
    { key: 'overdue', header: 'Overdue', render: (row) => <span className={assignmentMetrics(memberGroups.get(row.id) ?? [], initialToday).overdue ? 'font-semibold text-red-600' : ''}>{assignmentMetrics(memberGroups.get(row.id) ?? [], initialToday).overdue}</span> },
    { key: 'progress', header: 'Progress', render: (row) => <ProgressSummary value={assignmentMetrics(memberGroups.get(row.id) ?? [], initialToday).completion} /> },
  ];

  const projectTable = <CompactDataTable columns={[
    { key: 'project', header: 'Project', render: (rows: KeyAssignment[]) => <Link href={`/projects/${rows[0].projectId}`} className="font-semibold text-blue-700 hover:underline"><TruncatedText>{rows[0].projectName}</TruncatedText></Link> },
    { key: 'members', header: 'Members', render: (rows: KeyAssignment[]) => uniqueCount(rows, (row) => row.memberId) },
    { key: 'tasks', header: 'Tasks', render: (rows: KeyAssignment[]) => rows.length },
    { key: 'overdue', header: 'Overdue', render: (rows: KeyAssignment[]) => assignmentMetrics(rows, initialToday).overdue },
    { key: 'progress', header: 'Progress', render: (rows: KeyAssignment[]) => <ProgressSummary value={assignmentMetrics(rows, initialToday).completion} /> },
  ]} rows={projectGroups} rowKey={(rows) => rows[0].projectId} />;

  const goalTable = <CompactDataTable columns={[
    { key: 'key', header: 'Key', render: (rows: KeyAssignment[]) => <span className="font-semibold text-slate-800">{rows[0].keyCode.replaceAll('_', ' ')}</span> },
    { key: 'goal', header: 'Sub Goal', render: (rows: KeyAssignment[]) => <TruncatedText>{rows[0].subGoalTitle}</TruncatedText> },
    { key: 'projects', header: 'Projects', render: (rows: KeyAssignment[]) => uniqueCount(rows, (row) => row.projectId) },
    { key: 'members', header: 'Members', render: (rows: KeyAssignment[]) => uniqueCount(rows, (row) => row.memberId) },
    { key: 'tasks', header: 'Tasks', render: (rows: KeyAssignment[]) => rows.length },
    { key: 'progress', header: 'Progress', render: (rows: KeyAssignment[]) => <ProgressSummary value={assignmentMetrics(rows, initialToday).completion} /> },
  ]} rows={goalGroups} rowKey={(rows) => `${rows[0].keyId}:${rows[0].subGoalId}`} />;

  return (
    <>
      <ManagementPageHeader eyebrow="Department" title={`${department.name} Department`} meta={department.description ?? 'Management overview and execution health'} actions={!department.isActive ? <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">Inactive</span> : undefined} />
      <ManagementKpiRow items={[
        { label: 'Members', value: members.length, tone: 'blue' },
        { label: 'Active Projects', value: uniqueCount(assignments.filter((item) => !['Done', 'Cancelled'].includes(item.status)), (item) => item.projectId), tone: 'blue' },
        { label: 'Open Tasks', value: metrics.active, tone: 'blue' },
        { label: 'Done This Week', value: doneThisWeek, tone: 'green' },
        { label: 'Overdue', value: metrics.overdue, tone: metrics.overdue ? 'red' : 'slate' },
        { label: 'Completion', value: `${metrics.completion}%`, tone: 'green' },
      ]} />
      <PageTabs active={tab} onChange={setTab} tabs={[
        { id: 'overview', label: 'Overview' }, { id: 'members', label: 'Members', count: members.length },
        { id: 'projects', label: 'Projects', count: projectGroups.length }, { id: 'goals', label: 'Goals', count: goalGroups.length },
        { id: 'tracker', label: 'Work Tracker' }, { id: 'reports', label: 'Reports' },
        { id: 'execution', label: 'Detailed Execution', count: assignments.length },
      ]} />

      {tab === 'overview' && <div className="grid gap-5 xl:grid-cols-2"><section><SectionHeading title="Member performance" description="Open work, weekly completion, and overdue pressure." /><CompactDataTable columns={memberColumns} rows={members.slice(0, 8)} rowKey={(row) => row.id} onRowClick={setSelectedMember} /></section><section><SectionHeading title="Active projects" />{projectTable}</section><section className="xl:col-span-2"><SectionHeading title="Key / Sub Goal progress" />{goalTable}</section></div>}
      {tab === 'members' && <><SectionHeading title="Members" description="Select a row for a quick view or open the full member page." /><CompactDataTable columns={memberColumns} rows={members} rowKey={(row) => row.id} onRowClick={setSelectedMember} /></>}
      {tab === 'projects' && <><SectionHeading title="Projects" description="Project delivery health across this department." />{projectTable}</>}
      {tab === 'goals' && <><SectionHeading title="Goals" description="KEY and Sub Goal involvement without expanding the full hierarchy." />{goalTable}</>}
      {tab === 'tracker' && <DailyWorkTracker assignments={assignments} initialDailyStatuses={assignments.flatMap((item) => item.dailyStatuses ?? [])} initialToday={initialToday} />}
      {tab === 'reports' && <><SectionHeading title="Member performance" description="Assignment outcomes from the current department scope." /><CompactDataTable columns={memberColumns} rows={members} rowKey={(row) => row.id} onRowClick={setSelectedMember} /></>}
      {tab === 'execution' && <><SectionHeading title="Detailed execution" description="Full KEY → Sub Goal → Project → Task → Member hierarchy." /><AssignmentHierarchy assignments={assignments} /></>}

      {selectedMember && (() => {
        const work = memberGroups.get(selectedMember.id) ?? [];
        const summary = assignmentMetrics(work, initialToday);
        return <DetailDrawer title={selectedMember.name} subtitle={`${selectedMember.team ?? 'No team'} · ${selectedMember.roleTitle ?? 'Designation not set'}`} onClose={() => setSelectedMember(undefined)}><ManagementKpiRow items={[{ label: 'Projects', value: uniqueCount(work, (item) => item.projectId) }, { label: 'Open', value: summary.active }, { label: 'Done', value: summary.done, tone: 'green' }, { label: 'Overdue', value: summary.overdue, tone: summary.overdue ? 'red' : 'slate' }]} /><ProgressSummary value={summary.completion} /><Link href={`/members/${selectedMember.id}`} className="mt-6 inline-flex rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">Open member page</Link></DetailDrawer>;
      })()}
    </>
  );
}
