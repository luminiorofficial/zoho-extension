import { isDate } from './planner-validation';

export const REPORT_PERIOD_TYPES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const;

export type ReportPeriodType = (typeof REPORT_PERIOD_TYPES)[number];

export interface ReportingPeriod {
  type: ReportPeriodType;
  start: string;
  end: string;
}

export function isReportPeriodType(value: unknown): value is ReportPeriodType {
  return typeof value === 'string'
    && REPORT_PERIOD_TYPES.includes(value as ReportPeriodType);
}

function dateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function reportingPeriod(type: ReportPeriodType, dateValue: string): ReportingPeriod | null {
  if (!isDate(dateValue)) return null;
  const date = new Date(`${dateValue}T00:00:00Z`);
  let start: Date;
  let end: Date;

  if (type === 'WEEKLY') {
    start = addUtcDays(date, -((date.getUTCDay() + 6) % 7));
    end = addUtcDays(start, 6);
  } else if (type === 'MONTHLY') {
    start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  } else if (type === 'QUARTERLY') {
    const financialMonth = (date.getUTCMonth() + 9) % 12;
    const quarterStartMonth = ((Math.floor(financialMonth / 3) * 3) + 3) % 12;
    const startYear = quarterStartMonth > date.getUTCMonth()
      ? date.getUTCFullYear() - 1
      : date.getUTCFullYear();
    start = new Date(Date.UTC(startYear, quarterStartMonth, 1));
    end = new Date(Date.UTC(startYear, quarterStartMonth + 3, 0));
  } else {
    const startYear = date.getUTCMonth() < 3
      ? date.getUTCFullYear() - 1
      : date.getUTCFullYear();
    start = new Date(Date.UTC(startYear, 3, 1));
    end = new Date(Date.UTC(startYear + 1, 2, 31));
  }

  return { type, start: dateString(start), end: dateString(end) };
}

export function periodDisplayLabel(period: ReportingPeriod): string {
  if (period.type === 'QUARTERLY') {
    const month = Number(period.start.slice(5, 7));
    const quarter = month === 4 ? 1 : month === 7 ? 2 : month === 10 ? 3 : 4;
    return `Financial Quarter Q${quarter}`;
  }
  if (period.type === 'YEARLY') {
    const year = Number(period.start.slice(0, 4));
    return `Financial Year ${year}–${String(year + 1).slice(-2)}`;
  }
  return period.type === 'WEEKLY' ? 'Weekly' : 'Monthly';
}
