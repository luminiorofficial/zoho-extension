'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';

import ProgressBar from '@/components/common/ProgressBar';
import { cn } from '@/lib/utils';

export interface ManagementTab<T extends string> {
  id: T;
  label: string;
  count?: number;
}

export function ManagementPageHeader({
  eyebrow,
  title,
  meta,
  actions,
}: {
  eyebrow: string;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-600">{eyebrow}</p>
        <h1 className="mt-1 truncate text-[1.65rem] font-bold leading-tight text-slate-950" title={title}>{title}</h1>
        {meta && <div className="mt-1.5 text-sm text-slate-600">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

const toneClass = {
  slate: 'border-slate-200 before:bg-slate-400',
  blue: 'border-blue-200 before:bg-blue-500',
  green: 'border-emerald-200 before:bg-emerald-500',
  amber: 'border-amber-200 before:bg-amber-500',
  red: 'border-red-200 before:bg-red-500',
} as const;

export interface ManagementKpi {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: keyof typeof toneClass;
}

export function ManagementKpiRow({ items }: { items: ManagementKpi[] }) {
  return (
    <section className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6" aria-label="Summary metrics">
      {items.map((item) => (
        <div key={item.label} className={cn('relative overflow-hidden rounded-lg border bg-white px-3.5 py-3 before:absolute before:inset-y-0 before:left-0 before:w-1', toneClass[item.tone ?? 'slate'])}>
          <p className="truncate text-xs font-semibold text-slate-500" title={item.label}>{item.label}</p>
          <p className="mt-1 text-2xl font-bold leading-none text-slate-950">{item.value}</p>
          {item.detail && <div className="mt-1.5 truncate text-xs text-slate-500">{item.detail}</div>}
        </div>
      ))}
    </section>
  );
}

export function PageTabs<T extends string>({
  tabs,
  active,
  onChange,
  label = 'Page sections',
}: {
  tabs: ManagementTab<T>[];
  active: T;
  onChange: (tab: T) => void;
  label?: string;
}) {
  return (
    <nav className="sticky top-0 z-20 mb-4 flex gap-1 overflow-x-auto border-y border-slate-200 bg-slate-50/95 py-2 backdrop-blur" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          aria-current={active === tab.id ? 'page' : undefined}
          className={cn(
            'flex min-w-fit items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
            active === tab.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900',
          )}
        >
          {tab.label}
          {tab.count !== undefined && <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', active === tab.id ? 'bg-white/15' : 'bg-slate-200 text-slate-600')}>{tab.count}</span>}
        </button>
      ))}
    </nav>
  );
}

export function FilterToolbar({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2">{children}</div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ToolbarField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('min-w-36 flex-1 text-xs font-semibold text-slate-600', className)}>
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

export const compactFieldClass = 'h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export interface CompactColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
}

export function CompactDataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = 'No records to show.',
  onRowClick,
  minWidth = 760,
}: {
  columns: CompactColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  minWidth?: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="max-h-[62vh] overflow-auto">
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <thead className="sticky top-0 z-10 bg-slate-100 text-xs font-bold uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_#e2e8f0]">
            <tr>{columns.map((column) => <th key={column.key} className={cn('whitespace-nowrap px-3 py-2.5', column.className)}>{column.header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (event) => { if (event.key === 'Enter') onRowClick(row); } : undefined}
                className={cn('transition-colors hover:bg-slate-50', onRowClick && 'cursor-pointer focus:bg-blue-50 focus:outline-none')}
              >
                {columns.map((column) => <td key={column.key} className={cn('px-3 py-2.5 align-middle text-slate-700', column.className)}>{column.render(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="px-4 py-10 text-center text-sm text-slate-500">{emptyMessage}</p>}
      </div>
    </div>
  );
}

export function ProgressSummary({ value, label, className }: { value: number; label?: string; className?: string }) {
  return (
    <div className={cn('min-w-28', className)}>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
        <span>{label ?? 'Progress'}</span><span>{Math.round(value)}%</span>
      </div>
      <ProgressBar value={value} size="sm" />
    </div>
  );
}

export function SectionHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div><h2 className="text-base font-bold text-slate-900">{title}</h2>{description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}</div>
      {action}
    </div>
  );
}

export function DetailDrawer({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <aside className="ml-auto flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0"><h2 className="truncate text-lg font-bold text-slate-900">{title}</h2>{subtitle && <p className="mt-0.5 truncate text-sm text-slate-500">{subtitle}</p>}</div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Close details"><X size={19} /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}

export function TruncatedText({ children, className }: { children: string; className?: string }) {
  return <span className={cn('block max-w-64 truncate', className)} title={children}>{children}</span>;
}
