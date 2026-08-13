import type { CapacityStatus, ProjectStatus } from '@/types';

export const MAX_ACTIVE_PROJECTS = 3;

export const ACTIVE_PROJECT_STATUSES: readonly ProjectStatus[] = [
  'Active',
  'Internal Review',
  'Client Review',
  'Closure Pending',
];

export interface CapacityMetrics {
  activeProjectCount: number;
  openTaskCount: number;
  dueThisWeekTaskCount: number;
  overdueTaskCount: number;
}

export function isActiveProjectStatus(status: ProjectStatus): boolean {
  return ACTIVE_PROJECT_STATUSES.includes(status);
}

export function getCapacityStatus(metrics: CapacityMetrics): CapacityStatus {
  if (
    metrics.activeProjectCount > MAX_ACTIVE_PROJECTS
    || metrics.openTaskCount >= 12
    || metrics.dueThisWeekTaskCount >= 8
    || metrics.overdueTaskCount >= 4
  ) {
    return 'Overloaded';
  }

  if (
    metrics.activeProjectCount === MAX_ACTIVE_PROJECTS
    || metrics.openTaskCount >= 8
    || metrics.dueThisWeekTaskCount >= 5
    || metrics.overdueTaskCount >= 2
  ) {
    return 'Busy';
  }

  if (
    metrics.activeProjectCount === 0
    && metrics.openTaskCount <= 2
    && metrics.dueThisWeekTaskCount === 0
    && metrics.overdueTaskCount === 0
  ) {
    return 'Available';
  }

  return 'Normal';
}
