import { cn } from '@/lib/utils';
import type { ActionStatus, ProjectStatus } from '@/types';

type Status = ActionStatus | ProjectStatus;

interface StatusBadgeProps {
  status: Status;
  size?: 'sm' | 'md';
  className?: string;
}

const statusStyles: Record<Status, string> = {
  'Not Started': 'bg-zinc-100 text-zinc-700 border-zinc-200',
  'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
  Done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Planned: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  Active: 'bg-blue-50 text-blue-700 border-blue-200',
  'Internal Review': 'bg-violet-50 text-violet-700 border-violet-200',
  'Client Review': 'bg-amber-50 text-amber-700 border-amber-200',
  Delivered: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Closure Pending': 'bg-orange-50 text-orange-700 border-orange-200',
  Closed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        sizeClasses[size],
        statusStyles[status],
        className
      )}
    >
      {status}
    </span>
  );
}
