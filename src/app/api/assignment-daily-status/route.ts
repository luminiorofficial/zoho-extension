import {
  getAssignmentDailyStatuses,
  upsertAssignmentDailyStatus,
} from '@/lib/assignment-daily-status-data';
import { isAssignmentStatusCode } from '@/lib/assignment-status';
import { addDays, isDate, isUuid, textValue } from '@/lib/planner-validation';
import { revalidateKeyAssignmentViews } from '@/lib/revalidate-assignments';

interface DailyStatusPayload {
  assignmentId?: unknown;
  workDate?: unknown;
  status?: unknown;
  note?: unknown;
  updatedBy?: unknown;
}

function optionalUuid(value: string | null): string | undefined | null {
  if (!value) return undefined;
  return isUuid(value) ? value : null;
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const assignmentId = optionalUuid(query.get('assignmentId'));
  const memberId = optionalUuid(query.get('memberId'));
  const startDate = query.get('startDate') || undefined;
  const endDate = query.get('endDate') || undefined;

  if (
    assignmentId === null
    || memberId === null
    || (startDate !== undefined && !isDate(startDate))
    || (endDate !== undefined && !isDate(endDate))
    || (startDate && endDate && endDate < startDate)
    || (startDate && endDate && endDate > addDays(startDate, 366))
  ) {
    return Response.json({ error: 'Use valid assignment, member, and date filters (maximum 367 days).' }, { status: 400 });
  }

  try {
    const dailyStatuses = await getAssignmentDailyStatuses({
      assignmentId: assignmentId ?? undefined,
      memberId: memberId ?? undefined,
      startDate,
      endDate,
    });
    return Response.json({ dailyStatuses });
  } catch (error) {
    console.error('Could not read assignment daily statuses:', error);
    return Response.json({ error: 'Could not load daily work statuses.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  let payload: DailyStatusPayload;
  try {
    payload = await request.json() as DailyStatusPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const note = payload.note === null || payload.note === undefined || payload.note === ''
    ? null
    : textValue(payload.note, 2_000);
  const updatedBy = payload.updatedBy === null || payload.updatedBy === undefined || payload.updatedBy === ''
    ? null
    : payload.updatedBy;

  if (
    !isUuid(payload.assignmentId)
    || !isDate(payload.workDate)
    || !isAssignmentStatusCode(payload.status)
    || (note === null && payload.note !== null && payload.note !== undefined && payload.note !== '')
    || (updatedBy !== null && !isUuid(updatedBy))
  ) {
    return Response.json({ error: 'Use a valid assignment, work date, status, and note.' }, { status: 400 });
  }

  try {
    const dailyStatus = await upsertAssignmentDailyStatus({
      assignmentId: payload.assignmentId,
      workDate: payload.workDate,
      status: payload.status,
      note,
      updatedBy,
    });
    revalidateKeyAssignmentViews();
    return Response.json({ dailyStatus });
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && error.code === '23503') {
      return Response.json({ error: 'The assignment or updating member no longer exists.' }, { status: 400 });
    }
    console.error('Could not upsert assignment daily status:', error);
    return Response.json({ error: 'Could not save the daily work status.' }, { status: 500 });
  }
}
