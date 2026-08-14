'use client';

import { FormEvent, useState } from 'react';
import { CalendarCheck2, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';

import AttendanceStatusBadge from '@/components/attendance/AttendanceStatusBadge';
import type { AttendanceStatus, AttendanceSummary, LeaveRequest, Member } from '@/types';

const markableStatuses: AttendanceStatus[] = [
  'Present',
  'Half Day',
  'Absent',
  'Work on Holiday',
];

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export default function MemberAttendancePanel({
  member,
  departments,
  summary,
  leaveRequests,
}: {
  member: Member;
  departments: { id: string; name: string }[];
  summary: AttendanceSummary;
  leaveRequests: LeaveRequest[];
}) {
  const router = useRouter();
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>(
    summary.todayStatus === 'Approved Leave' || summary.todayStatus === 'Not Marked'
      ? 'Present'
      : summary.todayStatus,
  );
  const [attendanceNote, setAttendanceNote] = useState('');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function markAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, status: attendanceStatus, note: attendanceNote }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not mark attendance.');
      setMessage('Today’s availability has been updated.');
      setAttendanceNote('');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not mark attendance.');
    } finally {
      setPending(false);
    }
  }

  async function requestLeave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, departmentId, startDate, endDate, reason }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not submit leave request.');
      setMessage('Leave request submitted for review.');
      setStartDate('');
      setEndDate('');
      setReason('');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit leave request.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Attendance &amp; Availability</h2>
          <p className="mt-1 text-sm text-slate-500">Today&apos;s status and attendance history.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>Today:</span>
          <AttendanceStatusBadge status={summary.todayStatus} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <form onSubmit={markAttendance} className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
            <CalendarCheck2 size={18} /> Mark today
          </h3>
          {summary.todayStatus === 'Approved Leave' && (
            <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
              Today is controlled by an approved leave request and cannot be overwritten.
            </p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Availability
              <select
                value={attendanceStatus}
                onChange={(event) => setAttendanceStatus(event.target.value as AttendanceStatus)}
                disabled={summary.todayStatus === 'Approved Leave' || pending}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
              >
                {markableStatuses.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Note (optional)
              <input
                value={attendanceNote}
                onChange={(event) => setAttendanceNote(event.target.value)}
                disabled={summary.todayStatus === 'Approved Leave' || pending}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                placeholder="Availability details"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={summary.todayStatus === 'Approved Leave' || pending}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save today&apos;s status
          </button>
        </form>

        <form onSubmit={requestLeave} className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900"><Send size={17} /> Request leave</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {departments.length > 1 && (
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                Department
                <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </label>
            )}
            <label className="text-sm font-medium text-slate-700">From<input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm font-medium text-slate-700">To<input required type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">Reason<textarea required value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
          </div>
          <button type="submit" disabled={pending || !departmentId} className="mt-3 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Submit request</button>
        </form>
      </div>

      {(message || error) && <p className={`mt-4 rounded-lg p-3 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{error || message}</p>}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Object.entries(summary.counts).map(([status, count]) => (
          <div key={status} className="rounded-xl border border-slate-200 bg-white p-4">
            <AttendanceStatusBadge status={status as AttendanceStatus} />
            <p className="mt-2 text-xl font-bold text-slate-900">{count}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white xl:col-span-2">
          <div className="border-b border-slate-200 px-5 py-4"><h3 className="font-semibold text-slate-900">Attendance history</h3></div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Source</th><th className="px-5 py-3">Note</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {summary.history.map((record) => <tr key={record.id}><td className="px-5 py-3 text-slate-700">{formatDate(record.date)}</td><td className="px-5 py-3"><AttendanceStatusBadge status={record.status} /></td><td className="px-5 py-3 text-slate-500">{record.source}{record.isReadOnly ? ' · read-only' : ''}</td><td className="px-5 py-3 text-slate-500">{record.note ?? '—'}</td></tr>)}
                {!summary.history.length && <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-500">No attendance history yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900">Leave requests</h3>
          <div className="mt-3 space-y-3">
            {leaveRequests.map((request) => (
              <div key={request.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-2"><span className="font-medium text-slate-800">{formatDate(request.startDate)} – {formatDate(request.endDate)}</span><span className="text-xs font-semibold text-slate-600">{request.status}</span></div>
                <p className="mt-1 text-slate-600">{request.reason}</p>
                {request.reviewerName && <p className="mt-1 text-xs text-slate-400">Reviewed by {request.reviewerName}</p>}
              </div>
            ))}
            {!leaveRequests.length && <p className="text-sm text-slate-500">No leave requests.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
