import type { AttendanceStatus, AvailabilityStatus, LeaveRequestStatus } from '@/types';

export const attendanceStatusValues = [
  'PRESENT',
  'HALF_DAY',
  'APPROVED_LEAVE',
  'ABSENT',
  'WORK_ON_HOLIDAY',
] as const;

export type AttendanceStatusValue = (typeof attendanceStatusValues)[number];

export function attendanceStatusLabel(value: string): AttendanceStatus {
  if (value === 'HALF_DAY') return 'Half Day';
  if (value === 'APPROVED_LEAVE') return 'Approved Leave';
  if (value === 'WORK_ON_HOLIDAY') return 'Work on Holiday';
  if (value === 'ABSENT') return 'Absent';
  return 'Present';
}

export function availabilityStatusLabel(value: string): AvailabilityStatus {
  if (value === 'NOT_MARKED') return 'Not Marked';
  return attendanceStatusLabel(value);
}

export function attendanceStatusValue(value: AttendanceStatus): AttendanceStatusValue {
  if (value === 'Half Day') return 'HALF_DAY';
  if (value === 'Approved Leave') return 'APPROVED_LEAVE';
  if (value === 'Work on Holiday') return 'WORK_ON_HOLIDAY';
  if (value === 'Absent') return 'ABSENT';
  return 'PRESENT';
}

export function leaveStatusLabel(value: string): LeaveRequestStatus {
  if (value === 'APPROVED') return 'Approved';
  if (value === 'REJECTED') return 'Rejected';
  return 'Pending';
}

export function todayInIndia(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
