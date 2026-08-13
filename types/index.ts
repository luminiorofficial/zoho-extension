export type ActionStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Done';

export type Priority =
  | 'Low'
  | 'Medium'
  | 'High';

export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentId: string;
  departmentIds?: string[];
  specialization?: string;
  avatar?: string;
}

export type PeriodType =
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'YEARLY';

export interface PeriodProgress {
  periodType: PeriodType;
  periodStart: string;
  periodEnd: string;
  totalTasks: number;
  doneTasks: number;
  progress: number;
}

export interface Project {
  id: string;
  departmentId: string;
  goalId: string;
  goalTitle: string;
  code?: string;
  name: string;
  description?: string;
  status: ActionStatus;
  totalTasks: number;
  doneTasks: number;
  progress: number;
}

export interface DailyTask {
  id: string;
  weekGoalId: string;
  weekGoalTitle: string;
  actionId: string;
  actionTitle: string;
  projectId: string;
  projectName: string;
  assignedMemberId: string;
  taskDate: string;
  title: string;
  description?: string;
  status: ActionStatus;
}

export interface WeekGoal {
  id: string;
  title: string;
  description?: string;
  weekStart: string;
  weekEnd: string;
  actionId: string;
  actionTitle: string;
  projectId: string;
  projectName: string;
  assignedMemberId: string;
  assignedMemberName: string;
  totalTasks: number;
  doneTasks: number;
  progress: number;
  tasks: DailyTask[];
}

export interface WorkActionOption {
  id: string;
  goalId: string;
  goalTitle: string;
  title: string;
  code?: string;
}

export interface DepartmentWorkData {
  projects: Project[];
  weekGoals: WeekGoal[];
  periodProgress: PeriodProgress[];
}

export interface MemberWorkData extends DepartmentWorkData {
  actions: WorkActionOption[];
  tasks: DailyTask[];
}

export interface Target {
  id: string;
  goalId: string;
  title: string;
  targetText?: string;
  targetValue?: number;
  targetUnit?: string;
  periodType?: string;
}

export interface Action {
  id: string;
  goalId: string;

  code?: string;
  title: string;
  description?: string;

  assignedMemberIds: string[];

  status: ActionStatus;

  progress: number;

  dueDate?: string;

  priority?: Priority;
}

export interface Goal {
  id: string;

  departmentId: string;

  title: string;

  description?: string;

  progress: number;

  targets?: Target[];
  actions: Action[];
}

export interface Department {
  id: string;

  name: string;

  description?: string;

  headId?: string;

  memberIds: string[];

  progress: number;

  isActive: boolean;

  goals: Goal[];
}

export interface DepartmentCardProps {
  department: Department;
}

export interface GoalCardProps {
  goal: Goal;
  members: Member[];
}
