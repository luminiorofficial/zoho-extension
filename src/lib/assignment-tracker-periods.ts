import { addDays, isDate } from '@/lib/planner-validation';
import { reportingPeriod } from '@/lib/reporting-periods';

export type TrackerPeriodMode = 'RECENT_7' | 'DAYS_28' | 'MONTHLY' | 'QUARTERLY' | 'CUSTOM';
export type TrackerColumnKind = 'day' | 'week' | 'month';

export interface TrackerPeriod {
  start: string;
  end: string;
}

export interface TrackerColumn extends TrackerPeriod {
  key: string;
  kind: TrackerColumnKind;
  label: string;
}

function utcDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayInIndia(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(new Date());
}

export function inclusiveDayCount(start: string, end: string): number {
  return Math.floor((utcDate(end).getTime() - utcDate(start).getTime()) / 86_400_000) + 1;
}

export function dateRange(start: string, end: string): string[] {
  const values: string[] = [];
  for (let value = start; value <= end; value = addDays(value, 1)) values.push(value);
  return values;
}

export function trackerPeriod(
  mode: TrackerPeriodMode,
  anchor: string,
  custom?: TrackerPeriod,
): TrackerPeriod {
  if (mode === 'RECENT_7') return { start: addDays(anchor, -6), end: anchor };
  if (mode === 'DAYS_28') return { start: addDays(anchor, -27), end: anchor };

  if (mode === 'MONTHLY') {
    const date = utcDate(anchor);
    return {
      start: dateString(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))),
      end: dateString(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))),
    };
  }

  if (mode === 'QUARTERLY') {
    const period = reportingPeriod('QUARTERLY', anchor);
    return period ? { start: period.start, end: period.end } : { start: anchor, end: anchor };
  }

  return custom && isDate(custom.start) && isDate(custom.end) && custom.start <= custom.end
    ? custom
    : { start: addDays(anchor, -6), end: anchor };
}

export function moveTrackerAnchor(mode: TrackerPeriodMode, anchor: string, direction: -1 | 1): string {
  if (mode === 'RECENT_7') return addDays(anchor, direction * 7);
  if (mode === 'DAYS_28') return addDays(anchor, direction * 28);

  const date = utcDate(anchor);
  const months = mode === 'QUARTERLY' ? 3 : 1;
  // Normalize before changing month so dates such as 31 August do not skip
  // September through JavaScript's end-of-month overflow behavior.
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + direction * months);
  return dateString(date);
}

function shortDate(value: string, includeYear = false): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(utcDate(value));
}

export function periodLabel(period: TrackerPeriod): string {
  const includeYear = period.start.slice(0, 4) !== period.end.slice(0, 4);
  return `${shortDate(period.start, includeYear)}–${shortDate(period.end, true)}`;
}

export function trackerColumns(mode: TrackerPeriodMode, period: TrackerPeriod): TrackerColumn[] {
  const dayCount = inclusiveDayCount(period.start, period.end);
  if (mode === 'RECENT_7' || (mode === 'CUSTOM' && dayCount <= 7)) {
    return dateRange(period.start, period.end).map((date) => ({
      key: date,
      start: date,
      end: date,
      kind: 'day',
      label: new Intl.DateTimeFormat('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
      }).format(utcDate(date)),
    }));
  }

  if (mode !== 'QUARTERLY' && !(mode === 'CUSTOM' && dayCount > 92)) {
    const columns: TrackerColumn[] = [];
    let start = period.start;
    while (start <= period.end) {
      const end = addDays(start, 6) < period.end ? addDays(start, 6) : period.end;
      columns.push({
        key: `${start}:${end}`,
        start,
        end,
        kind: 'week',
        label: `${shortDate(start)}–${shortDate(end)}`,
      });
      start = addDays(end, 1);
    }
    return columns;
  }

  const columns: TrackerColumn[] = [];
  let cursor = utcDate(period.start);
  while (dateString(cursor) <= period.end) {
    const monthStart = dateString(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1)));
    const monthEnd = dateString(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)));
    const start = monthStart < period.start ? period.start : monthStart;
    const end = monthEnd > period.end ? period.end : monthEnd;
    columns.push({
      key: `${start}:${end}`,
      start,
      end,
      kind: 'month',
      label: new Intl.DateTimeFormat('en-IN', {
        month: 'short', year: 'numeric', timeZone: 'UTC',
      }).format(utcDate(start)),
    });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return columns;
}
