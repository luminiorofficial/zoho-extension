import type { KeyAssignment, KeyAssignmentStatus } from '@/types';

export interface AssignmentMetrics {
  total: number;
  done: number;
  inProgress: number;
  notStarted: number;
  onHold: number;
  cancelled: number;
  active: number;
  overdue: number;
  completion: number;
}

export function isAssignmentOverdue(assignment: KeyAssignment, today: string): boolean {
  return assignment.endDate < today
    && assignment.status !== 'Done'
    && assignment.status !== 'Cancelled';
}

export function assignmentMetrics(
  assignments: KeyAssignment[],
  today: string,
): AssignmentMetrics {
  const counts: Record<KeyAssignmentStatus, number> = {
    'Not Started': 0,
    'In Progress': 0,
    Done: 0,
    'On Hold': 0,
    Cancelled: 0,
  };

  for (const assignment of assignments) counts[assignment.status] += 1;

  const measurable = assignments.length - counts.Cancelled;
  return {
    total: assignments.length,
    done: counts.Done,
    inProgress: counts['In Progress'],
    notStarted: counts['Not Started'],
    onHold: counts['On Hold'],
    cancelled: counts.Cancelled,
    active: counts['Not Started'] + counts['In Progress'] + counts['On Hold'],
    overdue: assignments.filter((assignment) => isAssignmentOverdue(assignment, today)).length,
    completion: measurable ? Math.round((counts.Done / measurable) * 100) : 0,
  };
}

export function uniqueCount<T>(items: T[], key: (item: T) => string): number {
  return new Set(items.map(key)).size;
}

export function groupAssignments(
  assignments: KeyAssignment[],
  key: (assignment: KeyAssignment) => string,
): KeyAssignment[][] {
  const groups = new Map<string, KeyAssignment[]>();
  for (const assignment of assignments) {
    groups.set(key(assignment), [...(groups.get(key(assignment)) ?? []), assignment]);
  }
  return [...groups.values()];
}

export function recordedCompletion(assignments: KeyAssignment[]): number {
  const records = assignments.flatMap((assignment) => assignment.dailyStatuses ?? []);
  if (!records.length) return 0;
  return Math.round((records.filter((record) => record.status === 'DONE').length / records.length) * 100);
}

export function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

