import type { CSSProperties } from 'react';

interface DonutChartItem {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  items: DonutChartItem[];
  label: string;
  totalLabel: string;
}

export default function DonutChart({ items, label, totalLabel }: DonutChartProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let previousPercentage = 0;

  const gradient = total
    ? items.map((item) => {
      const start = previousPercentage * 3.6;
      previousPercentage += (item.value / total) * 100;
      return `${item.color} ${start}deg ${previousPercentage * 3.6}deg`;
    }).join(', ')
    : '#e2e8f0 0deg 360deg';

  const chartStyle = {
    backgroundImage: `conic-gradient(${gradient})`,
  } satisfies CSSProperties;

  return (
    <div className="grid items-center gap-5 sm:grid-cols-[minmax(0,11rem)_1fr]">
      <div
        className="relative mx-auto aspect-square w-full max-w-44 rounded-full"
        style={chartStyle}
        role="img"
        aria-label={`${label}: ${total} ${totalLabel}`}
      >
        <div className="absolute inset-[22%] grid place-items-center rounded-full bg-white px-2 text-center">
          <p className="text-2xl font-bold text-slate-900">{total}</p>
          <p className="text-xs text-slate-500">{totalLabel}</p>
        </div>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2" aria-label={`${label} breakdown`}>
        {items.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-3 text-sm text-slate-600">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
            <span className="font-semibold text-slate-900">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
