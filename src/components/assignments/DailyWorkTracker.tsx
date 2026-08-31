'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  History,
  LoaderCircle,
  Search,
  X,
} from 'lucide-react';

import AssignmentHistoryDrawer from '@/components/assignments/AssignmentHistoryDrawer';
import { ASSIGNMENT_STATUS_OPTIONS } from '@/lib/assignment-status';
import {
  dateRange,
  inclusiveDayCount,
  moveTrackerAnchor,
  periodLabel,
  todayInIndia,
  trackerColumns,
  trackerPeriod,
  type TrackerColumn,
  type TrackerPeriodMode,
} from '@/lib/assignment-tracker-periods';
import type { AssignmentDailyStatus, KeyAssignment, KeyAssignmentStatusCode } from '@/types';

const periodOptions: { mode: TrackerPeriodMode; label: string }[] = [
  { mode: 'RECENT_7', label: 'Recent 7 Days' },
  { mode: 'DAYS_28', label: '28 Days' },
  { mode: 'MONTHLY', label: 'Monthly' },
  { mode: 'QUARTERLY', label: 'Quarterly' },
  { mode: 'CUSTOM', label: 'Custom' },
];

const statusStyles: Record<KeyAssignmentStatusCode, string> = {
  NOT_STARTED: 'border-slate-200 bg-slate-50 text-slate-600',
  IN_PROGRESS: 'border-blue-200 bg-blue-50 text-blue-700',
  DONE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  ON_HOLD: 'border-amber-200 bg-amber-50 text-amber-700',
  CANCELLED: 'border-rose-200 bg-rose-50 text-rose-700',
};

interface HierarchyRow {
  assignment: KeyAssignment;
  keySpan?: number;
  subGoalSpan?: number;
  projectSpan?: number;
}

interface MemberGroup {
  id: string;
  name: string;
  rows: HierarchyRow[];
}

function groupBy<T>(items: T[], key: (item: T) => string): T[][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    groups.set(value, [...(groups.get(value) ?? []), item]);
  }
  return [...groups.values()];
}

function hierarchyGroups(assignments: KeyAssignment[]): MemberGroup[] {
  const sorted = [...assignments].sort((left, right) => (
    left.memberName.localeCompare(right.memberName)
    || left.keyCode.localeCompare(right.keyCode)
    || left.subGoalTitle.localeCompare(right.subGoalTitle)
    || left.projectName.localeCompare(right.projectName)
    || left.taskTitle.localeCompare(right.taskTitle)
  ));

  return groupBy(sorted, (assignment) => assignment.memberId).map((memberAssignments) => {
    const rows: HierarchyRow[] = [];
    for (const keyAssignments of groupBy(memberAssignments, (assignment) => assignment.keyId)) {
      let firstKey = true;
      for (const subGoalAssignments of groupBy(keyAssignments, (assignment) => assignment.subGoalId)) {
        let firstSubGoal = true;
        for (const projectAssignments of groupBy(subGoalAssignments, (assignment) => assignment.projectId)) {
          projectAssignments.forEach((assignment, index) => {
            rows.push({
              assignment,
              keySpan: firstKey ? keyAssignments.length : undefined,
              subGoalSpan: firstSubGoal ? subGoalAssignments.length : undefined,
              projectSpan: index === 0 ? projectAssignments.length : undefined,
            });
            firstKey = false;
            firstSubGoal = false;
          });
        }
      }
    }
    return { id: memberAssignments[0].memberId, name: memberAssignments[0].memberName, rows };
  });
}

function dailyKey(assignmentId: string, workDate: string): string {
  return `${assignmentId}:${workDate}`;
}

function statusMap(records: AssignmentDailyStatus[]): Record<string, AssignmentDailyStatus> {
  return Object.fromEntries(records.map((record) => [dailyKey(record.assignmentId, record.workDate), record]));
}

function formatPlanDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function NameButton({ value, onOpen, className = '' }: { value: string; onOpen: () => void; className?: string }) {
  return (
    <button type="button" onClick={onOpen} title={value} className={`block w-full truncate text-left hover:text-blue-700 ${className}`}>
      {value}
    </button>
  );
}

function SummaryCell({
  assignment,
  column,
  records,
}: {
  assignment: KeyAssignment;
  column: TrackerColumn;
  records: Record<string, AssignmentDailyStatus>;
}) {
  const start = column.start > assignment.startDate ? column.start : assignment.startDate;
  const end = column.end < assignment.endDate ? column.end : assignment.endDate;
  if (end < start) return <span className="text-slate-300">—</span>;

  const counts: Record<KeyAssignmentStatusCode, number> = {
    NOT_STARTED: 0,
    IN_PROGRESS: 0,
    DONE: 0,
    ON_HOLD: 0,
    CANCELLED: 0,
  };
  const days = dateRange(start, end);
  const recordedStatuses: KeyAssignmentStatusCode[] = [];
  for (const workDate of days) {
    const record = records[dailyKey(assignment.id, workDate)];
    if (record) recordedStatuses.push(record.status);
  }
  if (recordedStatuses.length === 0) {
    return <span className="text-slate-300" title="No daily execution recorded">—</span>;
  }
  for (const status of recordedStatuses) counts[status] += 1;
  const completion = Math.round((counts.DONE / recordedStatuses.length) * 100);

  return (
    <div className="min-w-[116px]" title={`${recordedStatuses.length} of ${days.length} days recorded: ${counts.DONE} done, ${counts.IN_PROGRESS} in progress, ${counts.ON_HOLD} on hold, ${counts.CANCELLED} cancelled, ${counts.NOT_STARTED} not started`}>
      <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold text-slate-600">
        <span>{counts.DONE}/{recordedStatuses.length} done</span><span>{completion}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${completion}%` }} />
      </div>
      <div className="mt-1.5 flex gap-2 text-[10px] text-slate-500">
        {counts.IN_PROGRESS > 0 && <span className="text-blue-700">IP {counts.IN_PROGRESS}</span>}
        {counts.ON_HOLD > 0 && <span className="text-amber-700">Hold {counts.ON_HOLD}</span>}
        {counts.CANCELLED > 0 && <span className="text-rose-700">Can {counts.CANCELLED}</span>}
        {counts.NOT_STARTED > 0 && <span>NS {counts.NOT_STARTED}</span>}
      </div>
    </div>
  );
}

export default function DailyWorkTracker({
  assignments,
  initialDailyStatuses,
  initialToday,
}: {
  assignments: KeyAssignment[];
  initialDailyStatuses: AssignmentDailyStatus[];
  initialToday?: string;
}) {
  const today = initialToday ?? todayInIndia();
  const [mode, setMode] = useState<TrackerPeriodMode>('RECENT_7');
  const [anchor, setAnchor] = useState(today);
  const [customDraft, setCustomDraft] = useState({ start: trackerPeriod('RECENT_7', today).start, end: today });
  const [customRange, setCustomRange] = useState(customDraft);
  const [records, setRecords] = useState<Record<string, AssignmentDailyStatus>>(() => statusMap(initialDailyStatuses));
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set());
  const [collapsedMembers, setCollapsedMembers] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [historyAssignment, setHistoryAssignment] = useState<KeyAssignment>();
  const [detail, setDetail] = useState<{ label: string; value: string }>();
  const initialPeriod = trackerPeriod('RECENT_7', today);
  const loadedPeriodRef = useRef(`${initialPeriod.start}:${initialPeriod.end}`);

  const period = useMemo(
    () => trackerPeriod(mode, anchor, customRange),
    [anchor, customRange, mode],
  );
  const columns = useMemo(() => trackerColumns(mode, period), [mode, period]);

  useEffect(() => {
    const periodKey = `${period.start}:${period.end}`;
    if (loadedPeriodRef.current === periodKey) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      try {
        const query = new URLSearchParams({ startDate: period.start, endDate: period.end });
        const response = await fetch(`/api/assignment-daily-status?${query}`, { signal: controller.signal });
        const body = await response.json() as { dailyStatuses?: AssignmentDailyStatus[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? 'Could not load daily work statuses.');
        setRecords((current) => {
          const next = { ...current };
          for (const record of body.dailyStatuses ?? []) next[dailyKey(record.assignmentId, record.workDate)] = record;
          return next;
        });
        loadedPeriodRef.current = periodKey;
      } catch (loadError) {
        if ((loadError as Error).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Could not load daily work statuses.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [period.end, period.start]);

  const visibleAssignments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assignments.filter((assignment) => {
      if (assignment.startDate > period.end || assignment.endDate < period.start) return false;
      if (!query) return true;
      return [
        assignment.memberName,
        assignment.keyCode,
        assignment.keyTitle,
        assignment.subGoalTitle,
        assignment.projectName,
        assignment.taskTitle,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [assignments, period.end, period.start, search]);
  const members = useMemo(() => hierarchyGroups(visibleAssignments), [visibleAssignments]);

  function mergeRecord(record: AssignmentDailyStatus) {
    setRecords((current) => ({ ...current, [dailyKey(record.assignmentId, record.workDate)]: record }));
  }

  async function saveStatus(assignment: KeyAssignment, workDate: string, status: KeyAssignmentStatusCode) {
    const key = dailyKey(assignment.id, workDate);
    const previous = records[key];
    const optimistic: AssignmentDailyStatus = {
      id: previous?.id ?? '',
      assignmentId: assignment.id,
      workDate,
      status,
      note: previous?.note,
      updatedAt: new Date().toISOString(),
      updatedBy: previous?.updatedBy,
    };
    mergeRecord(optimistic);
    setPendingCells((current) => new Set(current).add(key));
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/assignment-daily-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: assignment.id,
          workDate,
          status,
          note: previous?.note ?? null,
        }),
      });
      const body = await response.json() as { dailyStatus?: AssignmentDailyStatus; error?: string };
      if (!response.ok || !body.dailyStatus) throw new Error(body.error ?? 'Could not save daily status.');
      mergeRecord(body.dailyStatus);
      setMessage(`${assignment.memberName} · ${assignment.taskTitle} · ${formatPlanDate(workDate)} saved.`);
    } catch (saveError) {
      setRecords((current) => {
        const next = { ...current };
        if (previous) next[key] = previous;
        else delete next[key];
        return next;
      });
      setError(saveError instanceof Error ? saveError.message : 'Could not save daily status.');
    } finally {
      setPendingCells((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  function setPeriodMode(nextMode: TrackerPeriodMode) {
    setMode(nextMode);
    setError('');
    setMessage('');
  }

  function applyCustomRange() {
    if (!customDraft.start || !customDraft.end || customDraft.end < customDraft.start) {
      setError('Choose a valid custom date range.');
      return;
    }
    if (inclusiveDayCount(customDraft.start, customDraft.end) > 367) {
      setError('Choose a custom range of 367 days or less.');
      return;
    }
    setError('');
    setCustomRange(customDraft);
  }

  function toggleMember(memberId: string) {
    setCollapsedMembers((current) => {
      const next = new Set(current);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  }

  const currentLabel = periodLabel(period);
  const previousPeriod = trackerPeriod(mode, moveTrackerAnchor(mode, anchor, -1), customRange);
  const nextPeriod = trackerPeriod(mode, moveTrackerAnchor(mode, anchor, 1), customRange);

  return (
    <section aria-labelledby="daily-tracker-title">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2"><CalendarDays size={18} className="text-blue-600" /><h2 id="daily-tracker-title" className="text-lg font-semibold text-slate-900">Daily Tracker</h2></div>
              <p className="mt-1 text-sm text-slate-500">Daily execution status is separate from each assignment’s overall planned status.</p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find member, project or task" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2" aria-label="Tracker period">
            {periodOptions.map((option) => (
              <button key={option.mode} type="button" onClick={() => setPeriodMode(option.mode)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${mode === option.mode ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                {option.label}
              </button>
            ))}
          </div>

          {mode === 'CUSTOM' && (
            <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3">
              <label className="text-xs font-medium text-slate-600">From<input type="date" value={customDraft.start} onChange={(event) => setCustomDraft((current) => ({ ...current, start: event.target.value }))} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-xs font-medium text-slate-600">To<input type="date" value={customDraft.end} onChange={(event) => setCustomDraft((current) => ({ ...current, end: event.target.value }))} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
              <button type="button" disabled={!customDraft.start || !customDraft.end || customDraft.end < customDraft.start} onClick={applyCustomRange} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">Apply Range</button>
              <p className="text-xs text-slate-500">Up to 7 days stays daily; longer ranges are summarized.</p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {mode !== 'CUSTOM' && (
              <button type="button" onClick={() => setAnchor((current) => moveTrackerAnchor(mode, current, -1))} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50" title="Previous period"><ChevronLeft size={14} />{periodLabel(previousPeriod)}</button>
            )}
            <div className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">{currentLabel}</div>
            {mode !== 'CUSTOM' && (
              <button type="button" onClick={() => setAnchor((current) => moveTrackerAnchor(mode, current, 1))} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50" title="Next period">{periodLabel(nextPeriod)}<ChevronRight size={14} /></button>
            )}
          </div>
          <div className="mt-3 min-h-5 text-center text-xs">
            {loading && <span className="inline-flex items-center gap-1 text-slate-500"><LoaderCircle size={13} className="animate-spin" />Loading period…</span>}
            {error && <span className="text-red-600" role="alert">{error}</span>}
            {!error && message && <span className="text-emerald-700" role="status">{message}</span>}
          </div>
        </div>

        <div className="max-h-[68vh] overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-left text-xs" style={{ minWidth: 760 + columns.length * (columns[0]?.kind === 'day' ? 126 : 150) }}>
            <thead className="sticky top-0 z-30 bg-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_#e2e8f0]">
              <tr>
                <th className="sticky left-0 z-40 w-36 min-w-36 border-r border-slate-200 bg-slate-100 px-3 py-3">Member</th>
                <th className="w-20 min-w-20 px-3 py-3">Key</th>
                <th className="w-40 min-w-40 px-3 py-3">Sub Goal</th>
                <th className="w-40 min-w-40 px-3 py-3">Project</th>
                <th className="w-52 min-w-52 border-r border-slate-200 px-3 py-3">Task</th>
                {columns.map((column) => <th key={column.key} className="min-w-[126px] border-r border-slate-200 px-3 py-3 text-center normal-case tracking-normal">{column.label}</th>)}
              </tr>
            </thead>
            {members.map((member) => {
              const collapsed = collapsedMembers.has(member.id);
              if (collapsed) {
                return (
                  <tbody key={member.id} className="border-b border-slate-200">
                    <tr>
                      <td className="sticky left-0 z-20 border-b border-r border-slate-200 bg-white px-3 py-3 font-semibold text-slate-800"><button type="button" onClick={() => toggleMember(member.id)} className="flex w-full items-center gap-2 text-left"><ChevronDown size={14} className="-rotate-90 text-slate-400" /><span className="truncate">{member.name}</span></button></td>
                      <td colSpan={4 + columns.length} className="border-b border-slate-200 bg-slate-50/50 px-4 py-3 text-slate-500">{member.rows.length} task assignment{member.rows.length === 1 ? '' : 's'} hidden</td>
                    </tr>
                  </tbody>
                );
              }
              return (
                <tbody key={member.id} className="group/member">
                  {member.rows.map((row, rowIndex) => {
                    const assignment = row.assignment;
                    return (
                      <tr key={assignment.id} className="hover:bg-blue-50/30">
                        {rowIndex === 0 && (
                          <td rowSpan={member.rows.length} className="sticky left-0 z-20 w-36 border-b border-r border-slate-200 bg-white px-3 py-3 align-top font-semibold text-slate-800 shadow-[2px_0_4px_-4px_#64748b]">
                            <button type="button" onClick={() => toggleMember(member.id)} className="flex w-full items-start gap-2 text-left"><ChevronDown size={14} className="mt-0.5 shrink-0 text-slate-400" /><span className="break-words">{member.name}</span></button>
                            <span className="mt-1 block pl-5 text-[10px] font-normal text-slate-400">{member.rows.length} task{member.rows.length === 1 ? '' : 's'}</span>
                          </td>
                        )}
                        {row.keySpan && <td rowSpan={row.keySpan} className="border-b border-slate-200 px-3 py-3 align-top font-semibold text-slate-700">{assignment.keyCode.replace('_', ' ')}</td>}
                        {row.subGoalSpan && <td rowSpan={row.subGoalSpan} className="max-w-40 border-b border-slate-200 px-3 py-3 align-top text-slate-600"><NameButton value={assignment.subGoalTitle} onOpen={() => setDetail({ label: 'Sub Goal', value: assignment.subGoalTitle })} /></td>}
                        {row.projectSpan && <td rowSpan={row.projectSpan} className="max-w-40 border-b border-slate-200 px-3 py-3 align-top"><NameButton value={assignment.projectName} onOpen={() => setDetail({ label: 'Project', value: assignment.projectName })} className="font-medium text-slate-700" /><span className="mt-0.5 block truncate text-[10px] text-slate-400">{assignment.departmentName}</span></td>}
                        <td className="max-w-52 border-b border-r border-slate-200 px-3 py-2 align-top">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1"><NameButton value={assignment.taskTitle} onOpen={() => setDetail({ label: 'Task', value: assignment.taskTitle })} className="font-semibold text-slate-800" /><span className="mt-0.5 block text-[10px] text-slate-400">{formatPlanDate(assignment.startDate)} – {formatPlanDate(assignment.endDate)}</span></div>
                            <button type="button" onClick={() => setHistoryAssignment(assignment)} title="View history" aria-label={`View history for ${assignment.taskTitle}`} className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"><History size={14} /></button>
                          </div>
                        </td>
                        {columns.map((column) => {
                          if (column.kind !== 'day') {
                            return <td key={column.key} className="border-b border-r border-slate-200 px-3 py-2.5 align-middle"><SummaryCell assignment={assignment} column={column} records={records} /></td>;
                          }
                          const isPlanned = column.start >= assignment.startDate && column.start <= assignment.endDate;
                          const key = dailyKey(assignment.id, column.start);
                          const status = records[key]?.status;
                          const pending = pendingCells.has(key);
                          return (
                            <td key={column.key} className="border-b border-r border-slate-200 px-2 py-2 text-center">
                              {isPlanned ? (
                                <div className="relative inline-block">
                                  <select
                                    value={status ?? ''}
                                    disabled={pending}
                                    aria-label={`${assignment.taskTitle} status on ${column.start}`}
                                    onChange={(event) => void saveStatus(assignment, column.start, event.target.value as KeyAssignmentStatusCode)}
                                    className={`w-[108px] rounded-full border px-2 py-1.5 text-[10px] font-semibold outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-60 ${status ? statusStyles[status] : 'border-slate-200 bg-white text-slate-400'}`}
                                  >
                                    <option value="" disabled>—</option>
                                    {ASSIGNMENT_STATUS_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
                                  </select>
                                  {pending && <LoaderCircle size={11} className="absolute -right-1 -top-1 animate-spin text-blue-600" />}
                                </div>
                              ) : <span className="text-slate-300" title="Outside the planned assignment dates">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
          {!members.length && <div className="px-6 py-16 text-center text-sm text-slate-500">No assignments overlap this period{search ? ' and search' : ''}.</div>}
        </div>
      </div>

      {historyAssignment && <AssignmentHistoryDrawer assignment={historyAssignment} onClose={() => setHistoryAssignment(undefined)} onSaved={mergeRecord} />}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label={`${detail.label} details`}>
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-900">{detail.label}</h3><button type="button" onClick={() => setDetail(undefined)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close details"><X size={18} /></button></div>
            <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{detail.value}</p>
          </div>
        </div>
      )}
    </section>
  );
}
