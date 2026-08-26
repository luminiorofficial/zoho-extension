import type { ClosureItemKey, ProjectStatus } from '@/types';

export const PROJECT_STATUS_VALUES: Record<ProjectStatus, string> = {
  Planned: 'PLANNED',
  Active: 'ACTIVE',
  'Internal Review': 'INTERNAL_REVIEW',
  'Client Review': 'CLIENT_REVIEW',
  Delivered: 'DELIVERED',
  'Closure Pending': 'CLOSURE_PENDING',
  Closed: 'CLOSED',
};

export const CLOSURE_ITEM_LABELS: Record<ClosureItemKey, string> = {
  FINAL_FORMATS_CHECKED: 'Final formats checked',
  DRIVE_CLOSURE_COMPLETED: 'Drive closure completed',
  PORTFOLIO_GIF_CREATED: 'Portfolio GIF created',
  PROJECT_PPT_COMPLETED: 'Project PPT completed',
  PORTFOLIO_UPDATE_COMPLETED: 'Portfolio / website / LinkedIn update completed',
  INVOICE_ACCOUNTS_NOTIFIED: 'Invoice raised / Accounts notified',
};
