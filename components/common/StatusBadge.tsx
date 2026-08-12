import { cn } from '@/lib/utils';

type Status = 'Not Started' | 'In Progress' | 'Done';

interface StatusBadgeProps {
  status: Status;
  size?: 'sm' | 'md';
  className?: string;
}

const statusStyles: Record<Status, string> = {
  'Not Started': 'bg-zinc-100 text-zinc-700 border-zinc-200',
  'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
  Done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
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