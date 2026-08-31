import type { KeyAssignmentStatus, KeyAssignmentStatusCode } from '@/types';

export const ASSIGNMENT_STATUS_OPTIONS = [
  { code: 'NOT_STARTED', label: 'Not Started' },
  { code: 'IN_PROGRESS', label: 'In Progress' },
  { code: 'DONE', label: 'Done' },
  { code: 'ON_HOLD', label: 'On Hold' },
  { code: 'CANCELLED', label: 'Cancelled' },
] as const satisfies readonly { code: KeyAssignmentStatusCode; label: KeyAssignmentStatus }[];

const statusCodes = new Set<string>(ASSIGNMENT_STATUS_OPTIONS.map((item) => item.code));

export function isAssignmentStatusCode(value: unknown): value is KeyAssignmentStatusCode {
  return typeof value === 'string' && statusCodes.has(value);
}

export function assignmentStatusLabel(code: string): KeyAssignmentStatus {
  return ASSIGNMENT_STATUS_OPTIONS.find((item) => item.code === code)?.label ?? 'Not Started';
}

export function assignmentStatusCode(status: KeyAssignmentStatus): KeyAssignmentStatusCode {
  return ASSIGNMENT_STATUS_OPTIONS.find((item) => item.label === status)?.code ?? 'NOT_STARTED';
}
