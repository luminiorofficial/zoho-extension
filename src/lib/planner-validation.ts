export function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isOptionalDate(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || value === '' || isDate(value);
}

export function textValue(value: unknown, maximumLength = Number.POSITIVE_INFINITY): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  return cleaned.length <= maximumLength ? cleaned : null;
}

// assignment_sub_goals.title becomes TEXT in migration 023. Keep one generous
// application guardrail so imported spreadsheet titles remain editable while
// accidental, unbounded request bodies are still rejected consistently.
export const SUB_GOAL_TITLE_MAX_LENGTH = 10_000;

export function subGoalTitleValue(value: unknown): string | null {
  return textValue(value, SUB_GOAL_TITLE_MAX_LENGTH);
}

export function uuidArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => !isUuid(item))) return null;
  return [...new Set(value)];
}

export function isoWeekStart(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isBusinessDayInWeek(taskDate: string, weekStart: string): boolean {
  if (!isDate(taskDate) || !isDate(weekStart) || isoWeekStart(weekStart) !== weekStart) {
    return false;
  }

  return taskDate >= weekStart && taskDate <= addDays(weekStart, 4);
}
