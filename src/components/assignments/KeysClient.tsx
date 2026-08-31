'use client';

import { useMemo, useState } from 'react';
import { ClipboardList, History, Pencil, Plus, Search, Settings2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import AssignmentFormModal from '@/components/assignments/AssignmentFormModal';
import AssignmentHistoryDrawer from '@/components/assignments/AssignmentHistoryDrawer';
import DailyWorkTracker from '@/components/assignments/DailyWorkTracker';
import SubGoalManager from '@/components/assignments/SubGoalManager';
import StatusBadge from '@/components/common/StatusBadge';
import type {
  AssignableMember,
  AssignableProject,
  AssignmentDailyStatus,
  AssignmentKey,
  KeyAssignment,
  TaskMasterItem,
} from '@/types';

type PlanningTab = 'TRACKER' | 'HISTORY' | 'SETUP';

interface KeysClientProps {
  keys: AssignmentKey[];
  assignments: KeyAssignment[];
  projects: AssignableProject[];
  tasks: TaskMasterItem[];
  members: AssignableMember[];
  initialDailyStatuses: AssignmentDailyStatus[];
  initialToday: string;
}

function plannedDates(assignment: KeyAssignment): string {
  const format = (value: string) => new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
  return `${format(assignment.startDate)} – ${format(assignment.endDate)}`;
}

function WorkHistory({ assignments }: { assignments: KeyAssignment[] }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<KeyAssignment>();
  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => assignments.filter((assignment) => !query || [
    assignment.memberName,
    assignment.taskTitle,
    assignment.projectName,
    assignment.subGoalTitle,
    assignment.keyCode,
  ].some((value) => value.toLowerCase().includes(query))), [assignments, query]);
  const groups = useMemo(() => {
    const grouped = new Map<string, KeyAssignment[]>();
    for (const assignment of filtered) grouped.set(assignment.memberId, [...(grouped.get(assignment.memberId) ?? []), assignment]);
    return [...grouped.values()].sort((left, right) => left[0].memberName.localeCompare(right[0].memberName));
  }, [filtered]);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-slate-900">Work History</h2><p className="mt-1 text-sm text-slate-500">Open any member/task record to review notes and correct older daily statuses.</p></div>
        <div className="relative w-full sm:w-72"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find member or task" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500" /></div>
      </div>
      <div className="space-y-4">
        {groups.map((memberAssignments) => (
          <article key={memberAssignments[0].memberId} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between bg-slate-50 px-5 py-3"><h3 className="font-semibold text-slate-800">{memberAssignments[0].memberName}</h3><span className="text-xs text-slate-400">{memberAssignments.length} task assignment{memberAssignments.length === 1 ? '' : 's'}</span></div>
            <div className="divide-y divide-slate-100">
              {memberAssignments.map((assignment) => (
                <div key={assignment.id} className="flex flex-wrap items-center gap-4 px-5 py-3 hover:bg-slate-50/60">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800" title={assignment.taskTitle}>{assignment.taskTitle}</p><p className="mt-0.5 truncate text-xs text-slate-500" title={`${assignment.keyCode.replace('_', ' ')} → ${assignment.subGoalTitle} → ${assignment.projectName}`}>{assignment.keyCode.replace('_', ' ')} → {assignment.subGoalTitle} → {assignment.projectName}</p></div>
                  <span className="whitespace-nowrap text-xs text-slate-400">{plannedDates(assignment)}</span>
                  <button type="button" onClick={() => setSelected(assignment)} className="flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"><History size={14} />View History</button>
                </div>
              ))}
            </div>
          </article>
        ))}
        {!groups.length && <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">No assignments match this search.</p>}
      </div>
      {selected && <AssignmentHistoryDrawer assignment={selected} onClose={() => setSelected(undefined)} />}
    </section>
  );
}

function AssignmentSetup({ keys, assignments, projects, tasks, members }: Omit<KeysClientProps, 'initialDailyStatuses' | 'initialToday'>) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<KeyAssignment>();
  const [pendingId, setPendingId] = useState<string>();
  const [error, setError] = useState('');
  const initialKey = keys.find((key) => key.subGoals.some((subGoal) => subGoal.isActive)) ?? keys[0];
  const initialSubGoal = initialKey?.subGoals.find((subGoal) => subGoal.isActive);

  async function removeAssignment(assignment: KeyAssignment) {
    if (!window.confirm(`Delete ${assignment.memberName}'s assignment for “${assignment.taskTitle}”? Its daily history will also be removed.`)) return;
    setPendingId(assignment.id);
    setError('');
    try {
      const response = await fetch(`/api/key-assignments/${assignment.id}`, { method: 'DELETE' });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not delete the assignment.');
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the assignment.');
    } finally {
      setPendingId(undefined);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(undefined);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Assignment Setup</h2><p className="mt-1 text-sm text-slate-500">Maintain the hierarchy and planned dates separately from daily execution.</p></div><button type="button" onClick={() => setModalOpen(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={16} />Add Assignment</button></div>
      <SubGoalManager keys={keys} />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h3 className="font-semibold text-slate-900">Assignments ({assignments.length})</h3><p className="mt-1 text-sm text-slate-500">Overall status and planned dates remain on <code className="text-xs">key_assignments</code>.</p></div>
        {error && <p className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">{error}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-xs">
            <thead className="bg-slate-50 uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Key → Sub Goal</th><th className="px-4 py-3">Project → Task</th><th className="px-4 py-3">Planned dates</th><th className="px-4 py-3">Overall status</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {assignments.map((assignment) => (
                <tr key={assignment.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-semibold text-slate-800">{assignment.memberName}</td>
                  <td className="max-w-64 px-4 py-3"><p className="font-medium text-slate-700">{assignment.keyCode.replace('_', ' ')}</p><p className="truncate text-slate-500" title={assignment.subGoalTitle}>{assignment.subGoalTitle}</p></td>
                  <td className="max-w-72 px-4 py-3"><p className="truncate font-medium text-slate-700" title={assignment.projectName}>{assignment.projectName}</p><p className="truncate text-slate-500" title={assignment.taskTitle}>{assignment.taskTitle}</p></td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{plannedDates(assignment)}</td>
                  <td className="px-4 py-3"><StatusBadge status={assignment.status} size="sm" /></td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-2"><button type="button" onClick={() => setEditing(assignment)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600" aria-label="Edit assignment"><Pencil size={14} /></button><button type="button" disabled={pendingId === assignment.id} onClick={() => void removeAssignment(assignment)} className="rounded-lg border border-red-100 p-2 text-red-500 hover:bg-red-50 disabled:opacity-50" aria-label="Delete assignment"><Trash2 size={14} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!assignments.length && <p className="px-5 py-12 text-center text-sm text-slate-500">No assignments have been saved yet.</p>}
        </div>
      </div>
      {(modalOpen || editing) && initialKey && (
        <AssignmentFormModal keys={keys} projects={projects} tasks={tasks} members={members} initialKeyId={editing?.keyId ?? initialKey.id} initialSubGoalId={editing?.subGoalId ?? initialSubGoal?.id ?? ''} assignment={editing} onClose={closeModal} />
      )}
    </section>
  );
}

export default function KeysClient(props: KeysClientProps) {
  const [tab, setTab] = useState<PlanningTab>('TRACKER');
  const tabs: { id: PlanningTab; label: string; icon: typeof ClipboardList }[] = [
    { id: 'TRACKER', label: 'Daily Tracker', icon: ClipboardList },
    { id: 'HISTORY', label: 'Work History', icon: History },
    { id: 'SETUP', label: 'Assignment Setup', icon: Settings2 },
  ];

  return (
    <div>
      <nav className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm" aria-label="Work Planning sections">
        {tabs.map((item) => {
          const Icon = item.icon;
          return <button key={item.id} type="button" onClick={() => setTab(item.id)} aria-current={tab === item.id ? 'page' : undefined} className={`flex min-w-fit flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${tab === item.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}><Icon size={16} />{item.label}</button>;
        })}
      </nav>
      {tab === 'TRACKER' && <DailyWorkTracker assignments={props.assignments} initialDailyStatuses={props.initialDailyStatuses} initialToday={props.initialToday} />}
      {tab === 'HISTORY' && <WorkHistory assignments={props.assignments} />}
      {tab === 'SETUP' && <AssignmentSetup keys={props.keys} assignments={props.assignments} projects={props.projects} tasks={props.tasks} members={props.members} />}
    </div>
  );
}
