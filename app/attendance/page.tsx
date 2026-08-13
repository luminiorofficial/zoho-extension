import { Layout } from '@/components';
import AttendanceClient from '@/components/attendance/AttendanceClient';
import {
  getAttendanceOptions,
  getAttendanceRecords,
  getAttendanceReviewers,
  getLeaveRequests,
} from '@/lib/attendance-data';
import { attendanceStatusValues, todayInIndia } from '@/lib/attendance-utils';
import { isDate, isUuid } from '@/lib/planner-validation';

export const dynamic = 'force-dynamic';

interface AttendancePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const query = await searchParams;
  const today = todayInIndia();
  const defaultFrom = `${today.slice(0, 8)}01`;
  const departmentId = isUuid(first(query.department)) ? first(query.department) : '';
  const memberId = isUuid(first(query.member)) ? first(query.member) : '';
  const from = query.from === undefined ? defaultFrom : (isDate(first(query.from)) ? first(query.from) : '');
  const to = query.to === undefined ? today : (isDate(first(query.to)) ? first(query.to) : '');
  const rawStatus = first(query.status);
  const status = attendanceStatusValues.includes(rawStatus as (typeof attendanceStatusValues)[number])
    ? rawStatus
    : '';

  const [records, options, leaveRequests, reviewers] = await Promise.all([
    getAttendanceRecords({ departmentId, memberId, from, to, status }),
    getAttendanceOptions(),
    getLeaveRequests({ departmentId, memberId }),
    getAttendanceReviewers(),
  ]);

  return (
    <Layout>
      <AttendanceClient
        records={records}
        departments={options.departments}
        members={options.members}
        leaveRequests={leaveRequests}
        reviewers={reviewers}
        filters={{ departmentId, memberId, from, to, status }}
      />
    </Layout>
  );
}
