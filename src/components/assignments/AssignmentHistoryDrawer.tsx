'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, LoaderCircle, Save, X } from 'lucide-react';

import { ASSIGNMENT_STATUS_OPTIONS } from '@/lib/assignment-status';
import { addDays } from '@/lib/planner-validation';
import { dateRange, todayInIndia } from '@/lib/assignment-tracker-periods';
import type { AssignmentDailyStatus, KeyAssignment, KeyAssignmentStatusCode } from '@/types';

function compactDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function statusClass(status: KeyAssignmentStatusCode): string {
  if (status === 'DONE') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'IN_PROGRESS') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'ON_HOLD') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'CANCELLED') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

export default function AssignmentHistoryDrawer({
  assignment,
  onClose,
  onSaved,
}: {
  assignment: KeyAssignment;
  onClose: () => void;
  onSaved?: (dailyStatus: AssignmentDailyStatus) => void;
}) {
  const today = todayInIndia();
  const latestPlannedDate = assignment.endDate < today ? assignment.endDate : today;
  const initialEnd = latestPlannedDate < assignment.startDate ? assignment.startDate : latestPlannedDate;
  const initialStart = addDays(initialEnd, -27) > assignment.startDate
    ? addDays(initialEnd, -27)
    : assignment.startDate;
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [appliedRange, setAppliedRange] = useState({ start: initialStart, end: initialEnd });
  const [records, setRecords] = useState<Record<string, AssignmentDailyStatus>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pendingDates, setPendingDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      assignmentId: assignment.id,
      startDate: appliedRange.start,
      endDate: appliedRange.end,
    });
    fetch(`/api/assignment-daily-status?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { dailyStatuses?: AssignmentDailyStatus[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? 'Could not load work history.');
        return body.dailyStatuses ?? [];
      })
      .then((dailyStatuses) => {
        const nextRecords: Record<string, AssignmentDailyStatus> = {};
        const nextNotes: Record<string, string> = {};
        for (const record of dailyStatuses) {
          nextRecords[record.workDate] = record;
          nextNotes[record.workDate] = record.note ?? '';
        }
        setRecords(nextRecords);
        setNotes(nextNotes);
      })
      .catch((loadError: unknown) => {
        if ((loadError as Error).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Could not load work history.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [appliedRange.end, appliedRange.start, assignment.id]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const days = useMemo(
    () => dateRange(appliedRange.start, appliedRange.end).reverse(),
    [appliedRange],
  );

  async function save(workDate: string, status: KeyAssignmentStatusCode, note: string) {
    setPendingDates((current) => new Set(current).add(workDate));
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/assignment-daily-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: assignment.id, workDate, status, note }),
      });
      const body = await response.json() as { dailyStatus?: AssignmentDailyStatus; error?: string };
      if (!response.ok || !body.dailyStatus) throw new Error(body.error ?? 'Could not save this day.');
      setRecords((current) => ({ ...current, [workDate]: body.dailyStatus! }));
      setNotes((current) => ({ ...current, [workDate]: body.dailyStatus?.note ?? '' }));
      setMessage(`${compactDate(workDate)} saved.`);
      onSaved?.(body.dailyStatus);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this day.');
    } finally {
      setPendingDates((current) => {
        const next = new Set(current);
        next.delete(workDate);
        return next;
      });
    }
  }

  function applyRange() {
    if (endDate < startDate) {
      setError('The end date cannot be before the start date.');
      return;
    }
    if (endDate > addDays(startDate, 366)) {
      setError('Choose a history range of 367 days or less.');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    setAppliedRange({ start: startDate, end: endDate });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45" role="dialog" aria-modal="true" aria-label="Assignment work history">
      <div className="flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-blue-600"><CalendarRange size={17} /><span className="text-xs font-semibold uppercase tracking-wide">Work History</span></div>
            <h2 className="mt-1 truncate text-lg font-semibold text-slate-900">{assignment.memberName} · {assignment.taskTitle}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">{assignment.keyCode.replace('_', ' ')} → {assignment.subGoalTitle} → {assignment.projectName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close history"><X size={20} /></button>
        </header>

        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-slate-600">From<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
            <label className="text-xs font-medium text-slate-600">To<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
            <button type="button" onClick={applyRange} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Load History</button>
            <p className="text-xs text-slate-500">Planned {compactDate(assignment.startDate)} – {compactDate(assignment.endDate)}</p>
          </div>
          {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
          {message && <p className="mt-3 text-sm text-emerald-700" role="status">{message}</p>}
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 sm:px-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><LoaderCircle size={18} className="animate-spin" />Loading history…</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-4 py-3">Work date</th><th className="px-4 py-3">Daily status</th><th className="px-4 py-3">Note</th><th className="px-4 py-3">Last saved</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {days.map((workDate) => {
                    const record = records[workDate];
                    const status = record?.status;
                    const pending = pendingDates.has(workDate);
                    return (
                      <tr key={workDate} className="hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">{compactDate(workDate)}</td>
                        <td className="px-4 py-3">
                          <select
                            aria-label={`Status for ${workDate}`}
                            value={status ?? ''}
                            disabled={pending}
                            onChange={(event) => void save(workDate, event.target.value as KeyAssignmentStatusCode, notes[workDate] ?? '')}
                            className={`w-32 rounded-full border px-2.5 py-1.5 text-xs font-semibold outline-none ${status ? statusClass(status) : 'border-slate-200 bg-white text-slate-400'}`}
                          >
                            <option value="" disabled>—</option>
                            {ASSIGNMENT_STATUS_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
                          </select>
                        </td>
                        <td className="min-w-[260px] px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              value={notes[workDate] ?? ''}
                              maxLength={2_000}
                              placeholder={status ? 'Optional note' : 'Choose a status first'}
                              onChange={(event) => setNotes((current) => ({ ...current, [workDate]: event.target.value }))}
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                            />
                            <button type="button" disabled={pending || !status} onClick={() => status && void save(workDate, status, notes[workDate] ?? '')} className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50" title={status ? 'Save note' : 'Choose a daily status first'}>
                              {pending ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
                            </button>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{record ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(record.updatedAt)) : 'Not recorded'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
