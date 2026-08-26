import { cn } from '@/lib/utils';
import type { CapacityStatus } from '@/types';

interface CapacityBadgeProps {
  status: CapacityStatus;
  className?: string;
}

const styles: Record<CapacityStatus, string> = {
  Available: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Normal: 'border-blue-200 bg-blue-50 text-blue-700',
  Busy: 'border-amber-200 bg-amber-50 text-amber-700',
  Overloaded: 'border-red-200 bg-red-50 text-red-700',
};

export default function CapacityBadge({ status, className }: CapacityBadgeProps) {
  return (
    <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', styles[status], className)}>
      {status}
    </span>
  );
}
