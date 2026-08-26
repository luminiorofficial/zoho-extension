import type { QueryResultRow } from 'pg';

import { db } from '@/lib/db';
import type {
  Action,
  ActionStatus,
  Department,
  Goal,
  Member,
  Priority,
  Target,
} from '@/types';

interface DepartmentRow extends QueryResultRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  progress_percent: string | null;
}

interface MemberRow extends QueryResultRow {
  id: string;
  name: string;
  email: string | null;
  role_title: string | null;
  team: string | null;
  current_department_id: string | null;
  is_active: boolean;
}

interface DepartmentMemberRow extends QueryResultRow {
  department_id: string;
  member_id: string;
  is_department_head: boolean;
}

interface GoalRow extends QueryResultRow {
  id: string;
  department_id: string;
  owner_member_id: string | null;
  code: string | null;
  title: string;
  description: string | null;
  progress_percent: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

interface TargetRow extends QueryResultRow {
  id: string;
  goal_id: string;
  title: string;
  target_text: string | null;
  target_value: string | null;
  target_unit: string | null;
  period_type: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

interface ActionRow extends QueryResultRow {
  id: string;
  goal_id: string;
  code: string | null;
  title: string;
  description: string | null;
  status: string;
  progress_percent: string;
  priority: string | null;
  due_date: string | null;
  start_date: string | null;
  is_active: boolean;
}

interface ActionAssigneeRow extends QueryResultRow {
  action_id: string;
  member_id: string;
}

export interface StructureData {
  departments: Department[];
  members: Member[];
}

function appendToMap(map: Map<string, string[]>, key: string, value: string): void {
  const current = map.get(key);
  if (current) {
    current.push(value);
  } else {
    map.set(key, [value]);
  }
}

function mapStatus(status: string): ActionStatus {
  if (status === 'DONE') return 'Done';
  if (status === 'IN_PROGRESS') return 'In Progress';
  if (status === 'ON_HOLD') return 'On Hold';
  if (status === 'CANCELLED') return 'Cancelled';
  return 'Not Started';
}

function mapPriority(priority: string | null): Priority | undefined {
  if (priority === 'LOW') return 'Low';
  if (priority === 'MEDIUM') return 'Medium';
  if (priority === 'HIGH') return 'High';
  if (priority === 'CRITICAL') return 'Critical';
  return undefined;
}

export async function getStructureData(): Promise<StructureData> {
  const [
    departmentResult,
    memberResult,
    departmentMemberResult,
    goalResult,
    targetResult,
    actionResult,
    actionAssigneeResult,
  ] = await Promise.all([
    db.query<DepartmentRow>(
      `SELECT d.id,
        d.name,
        d.description,
        d.is_active,
        dwp.progress_percent
   FROM departments d
   LEFT JOIN department_work_progress dwp
     ON dwp.department_id = d.id
  WHERE d.is_active = TRUE
  ORDER BY d.source_sheet NULLS LAST,
           d.source_row NULLS LAST,
           d.name`,
    ),
    db.query<MemberRow>(
      `SELECT id, name, email, role_title, team, current_department_id, is_active
         FROM members
        ORDER BY source_sheet NULLS LAST, source_row NULLS LAST, name`,
    ),
    db.query<DepartmentMemberRow>(
      `SELECT department_id, member_id, is_department_head
         FROM department_members
        ORDER BY created_at`,
    ),
    db.query<GoalRow>(
      `SELECT g.id,
              g.department_id,
              g.owner_member_id,
              g.code,
              g.title,
              g.description,
              g.status,
              g.start_date::text,
              g.end_date::text,
              g.is_active,
              COALESCE(gtp.progress_percent, g.progress_percent) AS progress_percent
         FROM goals g
         LEFT JOIN goal_task_progress gtp ON gtp.goal_id = g.id
        ORDER BY source_sheet NULLS LAST, source_row NULLS LAST, title`,
    ),
    db.query<TargetRow>(
      `SELECT id, goal_id, title, target_text, target_value, target_unit, period_type,
              start_date::text, end_date::text, is_active
         FROM targets
        ORDER BY source_sheet NULLS LAST, source_row NULLS LAST, title`,
    ),
    db.query<ActionRow>(
      `SELECT id, goal_id, code, title, description, effective_status AS status,
              effective_progress AS progress_percent, priority, due_date::text,
              start_date::text, is_active
         FROM (
           SELECT a.*,
                  COALESCE(atp.progress_percent, a.progress_percent) AS effective_progress,
                  CASE
                    WHEN atp.total_tasks IS NULL THEN a.status
                    WHEN atp.progress_percent = 100 THEN 'DONE'
                    WHEN atp.progress_percent > 0 THEN 'IN_PROGRESS'
                    ELSE 'NOT_STARTED'
                  END AS effective_status
             FROM actions a
             LEFT JOIN action_task_progress atp ON atp.action_id = a.id
         ) actions
        ORDER BY source_sheet NULLS LAST, source_row NULLS LAST, code NULLS LAST, title`,
    ),
    db.query<ActionAssigneeRow>(
      `SELECT action_id, member_id
         FROM action_assignees
        ORDER BY assigned_at`,
    ),
  ]);

  // Current organisation structure is based ONLY on members.current_department_id.
  // Historical department_members rows are preserved for old goals/plans/tasks.
  const memberIdsByDepartment = new Map<string, string[]>();
  const currentDepartmentByMember = new Map<string, string>();

  for (const member of memberResult.rows) {
    if (!member.current_department_id) continue;

    currentDepartmentByMember.set(member.id, member.current_department_id);

    if (member.is_active) {
      appendToMap(memberIdsByDepartment, member.current_department_id, member.id);
    }
  }

  const members: Member[] = memberResult.rows.map((member) => {
    const currentDepartmentId = member.current_department_id ?? '';

    return {
      id: member.id,
      name: member.name,
      email: member.email ?? '—',
      role: member.role_title ?? '—',
      team: member.team ?? '—',
      departmentId: currentDepartmentId,
      departmentIds: currentDepartmentId ? [currentDepartmentId] : [],
      isActive: member.is_active,
    };
  });

  const targetRowsByGoal = new Map<string, TargetRow[]>();
  for (const target of targetResult.rows) {
    const current = targetRowsByGoal.get(target.goal_id);
    if (current) current.push(target);
    else targetRowsByGoal.set(target.goal_id, [target]);
  }

  const memberIdsByAction = new Map<string, string[]>();
  for (const assignee of actionAssigneeResult.rows) {
    appendToMap(memberIdsByAction, assignee.action_id, assignee.member_id);
  }

  const actionRowsByGoal = new Map<string, ActionRow[]>();
  for (const action of actionResult.rows) {
    const current = actionRowsByGoal.get(action.goal_id);
    if (current) current.push(action);
    else actionRowsByGoal.set(action.goal_id, [action]);
  }

  const goalRowsByDepartment = new Map<string, GoalRow[]>();
  for (const goal of goalResult.rows) {
    const current = goalRowsByDepartment.get(goal.department_id);
    if (current) current.push(goal);
    else goalRowsByDepartment.set(goal.department_id, [goal]);
  }

  const departments: Department[] = departmentResult.rows.map((department) => {
    const goals: Goal[] = (goalRowsByDepartment.get(department.id) ?? []).map((goal) => {
      const targets: Target[] = (targetRowsByGoal.get(goal.id) ?? []).map((target) => ({
        id: target.id,
        goalId: target.goal_id,
        title: target.title,
        targetText: target.target_text ?? undefined,
        targetValue: target.target_value === null ? undefined : Number(target.target_value),
        targetUnit: target.target_unit ?? undefined,
        periodType: target.period_type ?? undefined,
        startDate: target.start_date ?? undefined,
        endDate: target.end_date ?? undefined,
        isActive: target.is_active,
      }));

      const actions: Action[] = (actionRowsByGoal.get(goal.id) ?? []).map((action) => ({
        id: action.id,
        goalId: action.goal_id,
        code: action.code ?? undefined,
        title: action.title,
        description: action.description ?? undefined,
        assignedMemberIds: memberIdsByAction.get(action.id) ?? [],
        status: mapStatus(action.status),
        progress: Number(action.progress_percent),
        dueDate: action.due_date ?? undefined,
        priority: mapPriority(action.priority),
        startDate: action.start_date ?? undefined,
        isActive: action.is_active,
      }));

      return {
        id: goal.id,
        departmentId: goal.department_id,
        ownerMemberId: goal.owner_member_id ?? undefined,
        code: goal.code ?? undefined,
        title: goal.title,
        description: goal.description ?? undefined,
        progress: Number(goal.progress_percent),
        status: mapStatus(goal.status),
        startDate: goal.start_date ?? undefined,
        endDate: goal.end_date ?? undefined,
        isActive: goal.is_active,
        targets,
        actions,
      };
    });

    const goalProgress = goals.length
      ? Math.round(goals.reduce((total, goal) => total + goal.progress, 0) / goals.length)
      : 0;

    const currentHead = departmentMemberResult.rows.find(
      (membership) =>
        membership.department_id === department.id &&
        membership.is_department_head &&
        currentDepartmentByMember.get(membership.member_id) === department.id,
    );

    return {
      id: department.id,
      name: department.name,
      description: department.description ?? undefined,
      memberIds: memberIdsByDepartment.get(department.id) ?? [],
      headId: currentHead?.member_id,
      progress: department.progress_percent === null
        ? goalProgress
        : Math.round(Number(department.progress_percent)),
      isActive: department.is_active,
      goals,
    };
  });

  return { departments, members };
}
