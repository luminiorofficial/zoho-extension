import type { AttendanceStatus } from '@/types';

const styles: Record<AttendanceStatus, string> = {
  Present: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  'Half Day': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  'Approved Leave': 'bg-blue-50 text-blue-700 ring-blue-600/20',
  Absent: 'bg-red-50 text-red-700 ring-red-600/20',
  'Work on Holiday': 'bg-violet-50 text-violet-700 ring-violet-600/20',
};

export default function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${styles[status]}`}>
      {status}
    </span>
  );
}
