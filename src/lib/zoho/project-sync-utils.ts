export interface ZohoProjectRecord {
  id: string | number;
  name?: string;
  status?: string | { name?: string };
}

export interface LocalProjectFields {
  masterJobNo: string;
  jobCode: string | null;
  name: string;
  clientName: string | null;
  status: 'PLANNED' | 'ACTIVE' | 'DELIVERED';
}

export function normalizeZohoProjectName(
  value: string | null | undefined,
): string {
  return (value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*\/\s*/g, '/')
    .toUpperCase();
}

export function getZohoProjectCode(
  value: string | null | undefined,
): string {
  const parts = normalizeZohoProjectName(value)
    .split('/')
    .filter(Boolean);

  return parts.length >= 3
    ? parts.slice(0, 3).join('/')
    : '';
}

function localStatus(
  value: ZohoProjectRecord['status'],
): LocalProjectFields['status'] {
  const status = (
    typeof value === 'string'
      ? value
      : value?.name ?? ''
  ).trim().toUpperCase();

  if (
    status.includes('COMPLETE') ||
    status.includes('CLOSED') ||
    status.includes('ARCHIVED')
  ) {
    return 'DELIVERED';
  }

  if (status.includes('ACTIVE') || status.includes('OPEN')) {
    return 'ACTIVE';
  }

  return 'PLANNED';
}

export function projectFieldsFromZoho(
  project: ZohoProjectRecord,
): LocalProjectFields {
  const masterJobNo = (project.name ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = masterJobNo
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

  const hasStructuredName = parts.length >= 4;
  const name = hasStructuredName
    ? parts.slice(3).join(' / ')
    : masterJobNo || `Zoho Project ${String(project.id)}`;

  return {
    masterJobNo,
    jobCode: hasStructuredName
      ? parts.slice(0, 3).join('/')
      : null,
    name,
    clientName: parts.length >= 5
      ? parts[parts.length - 2]
      : null,
    status: localStatus(project.status),
  };
}
