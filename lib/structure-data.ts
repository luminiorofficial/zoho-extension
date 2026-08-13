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
}

interface MemberRow extends QueryResultRow {
  id: string;
  name: string;
  email: string | null;
  role_title: string | null;
}

interface DepartmentMemberRow extends QueryResultRow {
  department_id: string;
  member_id: string;
}

interface GoalRow extends QueryResultRow {
  id: string;
  department_id: string;
  title: string;
  description: string | null;
  progress_percent: string;
}

interface TargetRow extends QueryResultRow {
  id: string;
  goal_id: string;
  title: string;
  target_text: string | null;
  target_value: string | null;
  target_unit: string | null;
  period_type: string | null;
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
  return 'Not Started';
}

function mapPriority(priority: string | null): Priority | undefined {
  if (priority === 'LOW') return 'Low';
  if (priority === 'MEDIUM') return 'Medium';
  if (priority === 'HIGH' || priority === 'CRITICAL') return 'High';
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
      `SELECT id, name, description, is_active
         FROM departments
        ORDER BY source_sheet NULLS LAST, source_row NULLS LAST, name`,
    ),
    db.query<MemberRow>(
      `SELECT id, name, email, role_title
         FROM members
        ORDER BY source_sheet NULLS LAST, source_row NULLS LAST, name`,
    ),
    db.query<DepartmentMemberRow>(
      `SELECT department_id, member_id
         FROM department_members
        ORDER BY created_at`,
    ),
    db.query<GoalRow>(
      `SELECT id, department_id, title, description, progress_percent
         FROM goals
        ORDER BY source_sheet NULLS LAST, source_row NULLS LAST, title`,
    ),
    db.query<TargetRow>(
      `SELECT id, goal_id, title, target_text, target_value, target_unit, period_type
         FROM targets
        ORDER BY source_sheet NULLS LAST, source_row NULLS LAST, title`,
    ),
    db.query<ActionRow>(
      `SELECT id, goal_id, code, title, description, status,
              progress_percent, priority, due_date
         FROM actions
        ORDER BY source_sheet NULLS LAST, source_row NULLS LAST, code NULLS LAST, title`,
    ),
    db.query<ActionAssigneeRow>(
      `SELECT action_id, member_id
         FROM action_assignees
        ORDER BY assigned_at`,
    ),
  ]);

  const departmentIdsByMember = new Map<string, string[]>();
  const memberIdsByDepartment = new Map<string, string[]>();
  for (const membership of departmentMemberResult.rows) {
    appendToMap(departmentIdsByMember, membership.member_id, membership.department_id);
    appendToMap(memberIdsByDepartment, membership.department_id, membership.member_id);
  }

  const members: Member[] = memberResult.rows.map((member) => {
    const departmentIds = departmentIdsByMember.get(member.id) ?? [];
    return {
      id: member.id,
      name: member.name,
      email: member.email ?? '—',
      role: member.role_title ?? '—',
      departmentId: departmentIds[0] ?? '',
      departmentIds,
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
      }));

      return {
        id: goal.id,
        departmentId: goal.department_id,
        title: goal.title,
        description: goal.description ?? undefined,
        progress: Number(goal.progress_percent),
        targets,
        actions,
      };
    });

    const progress = goals.length
      ? Math.round(goals.reduce((total, goal) => total + goal.progress, 0) / goals.length)
      : 0;

    return {
      id: department.id,
      name: department.name,
      description: department.description ?? undefined,
      memberIds: memberIdsByDepartment.get(department.id) ?? [],
      progress,
      isActive: department.is_active,
      goals,
    };
  });

  return { departments, members };
}
