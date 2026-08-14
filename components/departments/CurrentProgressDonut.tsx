import DonutChart from '@/components/common/DonutChart';
import type { PeriodProgress } from '@/types';

interface CurrentProgressDonutProps {
  progress: PeriodProgress;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export default function CurrentProgressDonut({ progress }: CurrentProgressDonutProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-slate-900">Current Progress · This Week</h3>
        <p className="mt-1 text-sm text-slate-500">
          Task statuses for {formatDate(progress.periodStart)}–{formatDate(progress.periodEnd)} only; this is not historical department progress.
        </p>
      </div>

      <DonutChart
        label="Current week task status"
        totalLabel="tasks this week"
        items={[
          { label: 'Done', value: progress.statusCounts.done, color: '#10b981' },
          { label: 'In Progress', value: progress.statusCounts.inProgress, color: '#3b82f6' },
          { label: 'Not Started', value: progress.statusCounts.notStarted, color: '#94a3b8' },
          { label: 'On Hold', value: progress.statusCounts.onHold, color: '#f59e0b' },
        ]}
      />
    </section>
  );
}
