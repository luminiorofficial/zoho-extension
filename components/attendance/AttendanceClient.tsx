'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import AttendanceStatusBadge from '@/components/attendance/AttendanceStatusBadge';
import { attendanceStatusValue } from '@/lib/attendance-utils';
import type {
  AttendanceRecord,
  AttendanceReviewer,
  LeaveRequest,
} from '@/types';
import { ATTENDANCE_STATUSES } from '@/types';

interface AttendanceClientProps {
  records: AttendanceRecord[];
  departments: { id: string; name: string }[];
  members: { id: string; name: string; departmentIds: string[] }[];
  leaveRequests: LeaveRequest[];
  reviewers: AttendanceReviewer[];
  filters: {
    departmentId: string;
    memberId: string;
    from: string;
    to: string;
    status: string;
  };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function requestStatusStyle(status: LeaveRequest['status']): string {
  if (status === 'Approved') return 'bg-emerald-50 text-emerald-700';
  if (status === 'Rejected') return 'bg-red-50 text-red-700';
  return 'bg-amber-50 text-amber-700';
}

export default function AttendanceClient({
  records,
  departments,
  members,
  leaveRequests,
  reviewers,
  filters,
}: AttendanceClientProps) {
  const router = useRouter();
  const [reviewerId, setReviewerId] = useState(reviewers[0]?.memberId ?? '');
  const [pendingRequestId, setPendingRequestId] = useState('');
  const [error, setError] = useState('');

  const visibleMembers = useMemo(() => (
    filters.departmentId
      ? members.filter((member) => member.departmentIds.includes(filters.departmentId))
      : members
  ), [filters.departmentId, members]);

  const counts = ATTENDANCE_STATUSES.map((status) => ({
    status,
    count: records.filter((record) => record.status === status).length,
  }));

  async function reviewLeave(requestId: string, decision: 'APPROVED' | 'REJECTED') {
    setPendingRequestId(requestId);
    setError('');
    try {
      const response = await fetch(`/api/leave-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewerMemberId: reviewerId, decision }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not review leave request.');
      router.refresh();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Could not review leave request.');
    } finally {
      setPendingRequestId('');
    }
  }

  return (
    <>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
        <p className="mt-1 text-sm text-slate-500">
          Live availability, approved leave, and read-only imported attendance history.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {counts.map(({ status, count }) => (
          <div key={status} className="rounded-xl border border-slate-200 bg-white p-4">
            <AttendanceStatusBadge status={status} />
            <p className="mt-3 text-2xl font-bold text-slate-900">{count}</p>
            <p className="mt-1 text-xs text-slate-500">matching records</p>
          </div>
        ))}
      </div>

      <form action="/attendance" className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm font-medium text-slate-700">Department<select name="department" defaultValue={filters.departmentId} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">All departments</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Member<select name="member" defaultValue={filters.memberId} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">All members</option>{visibleMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">From<input name="from" type="date" defaultValue={filters.from} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700">To<input name="to" type="date" defaultValue={filters.to} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700">Status<select name="status" defaultValue={filters.status} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">All statuses</option>{ATTENDANCE_STATUSES.map((status) => <option key={status} value={attendanceStatusValue(status)}>{status}</option>)}</select></label>
        </div>
        <div className="mt-4 flex gap-3">
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white">Apply filters</button>
          <Link href="/attendance" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Reset</Link>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Attendance records</h2>
          <span className="text-sm text-slate-500">{records.length} record{records.length === 1 ? '' : 's'}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Member</th><th className="px-5 py-3">Department</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Source</th><th className="px-5 py-3">Note</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((record) => (
                <tr key={`${record.id}-${record.date}`}>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-700">{formatDate(record.date)}</td>
                  <td className="px-5 py-3"><Link href={`/members/${record.memberId}`} className="font-medium text-slate-900 hover:text-blue-700">{record.memberName}</Link></td>
                  <td className="px-5 py-3 text-slate-500">{record.departmentNames.join(', ') || 'Unassigned'}</td>
                  <td className="px-5 py-3"><AttendanceStatusBadge status={record.status} /></td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500">{record.source}{record.isReadOnly ? ' · read-only' : ''}</td>
                  <td className="max-w-xs px-5 py-3 text-slate-500">{record.note ?? '—'}</td>
                </tr>
              ))}
              {!records.length && <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">No attendance records match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-lg font-semibold text-slate-900">Leave requests</h2><p className="mt-1 text-sm text-slate-500">Department Heads and Admins can review pending requests.</p></div>
          <label className="text-sm font-medium text-slate-700">Review as<select value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">Select reviewer</option>{reviewers.map((reviewer) => <option key={reviewer.memberId} value={reviewer.memberId}>{reviewer.memberName}{reviewer.isAdmin ? ' (Admin)' : ' (Department Head)'}</option>)}</select></label>
        </div>
        {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!reviewers.length && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">No Admin or Department Head is configured. Mark a department member as head before reviewing requests.</p>}
        <div className="space-y-3">
          {leaveRequests.map((request) => (
            <article key={request.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2"><Link href={`/members/${request.memberId}`} className="font-semibold text-slate-900 hover:text-blue-700">{request.memberName}</Link><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${requestStatusStyle(request.status)}`}>{request.status}</span></div>
                  <p className="mt-1 text-sm text-slate-500">{request.departmentName} · {formatDate(request.startDate)} – {formatDate(request.endDate)}</p>
                  <p className="mt-3 text-sm text-slate-700">{request.reason}</p>
                  {request.reviewerName && <p className="mt-2 text-xs text-slate-400">Reviewed by {request.reviewerName}{request.reviewNote ? ` · ${request.reviewNote}` : ''}</p>}
                </div>
                {request.status === 'Pending' && (
                  <div className="flex gap-2">
                    <button type="button" disabled={!reviewerId || Boolean(pendingRequestId)} onClick={() => reviewLeave(request.id, 'APPROVED')} className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50">Approve</button>
                    <button type="button" disabled={!reviewerId || Boolean(pendingRequestId)} onClick={() => reviewLeave(request.id, 'REJECTED')} className="rounded-lg border border-red-200 px-3.5 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Reject</button>
                  </div>
                )}
              </div>
            </article>
          ))}
          {!leaveRequests.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-500">No leave requests match the selected department or member.</div>}
        </div>
      </section>
    </>
  );
}
