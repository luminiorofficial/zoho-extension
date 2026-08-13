import { CalendarRange } from 'lucide-react';

import ProgressBar from './ProgressBar';

import type { PeriodProgress } from '@/types';

interface PeriodProgressCardsProps {
  progress: PeriodProgress[];
}

const labels = {
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Financial Quarter',
  YEARLY: 'Financial Year',
};

function periodLabel(period: PeriodProgress): string {
  if (period.periodType === 'QUARTERLY') {
    const startMonth = Number(period.periodStart.slice(5, 7));
    const quarter = startMonth === 4 ? 1 : startMonth === 7 ? 2 : startMonth === 10 ? 3 : 4;
    return `${labels.QUARTERLY} · Q${quarter}`;
  }

  if (period.periodType === 'YEARLY') {
    const startYear = Number(period.periodStart.slice(0, 4));
    return `${labels.YEARLY} · FY ${startYear}–${String(startYear + 1).slice(-2)}`;
  }

  return labels[period.periodType];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export default function PeriodProgressCards({ progress }: PeriodProgressCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {progress.map((period) => (
        <div
          key={period.periodType}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-700">
                {periodLabel(period)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {formatDate(period.periodStart)} – {formatDate(period.periodEnd)}
              </p>
            </div>

            <CalendarRange className="h-4 w-4 text-slate-400" />
          </div>

          <div className="mt-4 flex items-end justify-between">
            <p className="text-2xl font-bold text-slate-900">
              {Math.round(period.progress)}%
            </p>
            <p className="text-xs text-slate-500">
              {period.doneTasks}/{period.totalTasks} done
            </p>
          </div>

          <ProgressBar value={period.progress} size="sm" className="mt-3" />
        </div>
      ))}
    </div>
  );
}
