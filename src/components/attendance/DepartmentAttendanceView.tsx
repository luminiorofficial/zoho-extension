import Link from 'next/link';

import AttendanceStatusBadge from '@/components/attendance/AttendanceStatusBadge';
import DonutChart from '@/components/common/DonutChart';
import { AVAILABILITY_STATUSES, type DepartmentAttendanceMember } from '@/types';

export default function DepartmentAttendanceView({
  members,
}: {
  members: DepartmentAttendanceMember[];
}) {
  const counts = AVAILABILITY_STATUSES.map((status) => ({
    status,
    count: members.filter((member) => member.status === status).length,
  }));

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Today&apos;s Attendance</h2>
          <p className="mt-1 text-sm text-slate-500">
            Live availability for department staffing. Unmarked members appear as Not Marked.
          </p>
        </div>
        <Link href="/attendance" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          View attendance history
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {counts.map(({ status, count }) => (
          <div key={status} className="rounded-xl border border-slate-200 bg-white p-4">
            <AttendanceStatusBadge status={status} />
            <p className="mt-3 text-2xl font-bold text-slate-900">{count}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Today&apos;s Attendance</h3>
        <p className="mt-1 text-sm text-slate-500">Today&apos;s live department availability by attendance status.</p>
        <div className="mt-5">
          <DonutChart
            label="Today’s attendance"
            totalLabel="team members"
            items={counts.map(({ status, count }) => ({
              label: status,
              value: count,
              color: {
                Present: '#10b981',
                'Half Day': '#f59e0b',
                'Approved Leave': '#3b82f6',
                Absent: '#ef4444',
                'Work on Holiday': '#8b5cf6',
                'Not Marked': '#94a3b8',
              }[status],
            }))}
          />
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="divide-y divide-slate-100">
          {members.map((member) => (
            <div key={member.memberId} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div>
                <Link href={`/members/${member.memberId}`} className="font-medium text-slate-900 hover:text-blue-700">
                  {member.memberName}
                </Link>
                <p className="mt-0.5 text-xs text-slate-500">{member.role}</p>
              </div>
              <AttendanceStatusBadge status={member.status} />
            </div>
          ))}
          {!members.length && (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No active members in this department.</p>
          )}
        </div>
      </div>
    </section>
  );
}
