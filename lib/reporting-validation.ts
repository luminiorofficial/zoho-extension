import { isUuid, textValue } from './planner-validation';

export function optionalUuid(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  return isUuid(value) ? value : undefined;
}

export function nonNegativeNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

export function optionalScore(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : undefined;
}

export function optionalReportingText(value: unknown, maximumLength = 5000): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  const parsed = textValue(value, maximumLength);
  return parsed === null ? undefined : parsed || null;
}
