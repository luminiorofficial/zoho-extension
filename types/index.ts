export type ActionStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Done';

export const PROJECT_STATUSES = [
  'Planned',
  'Active',
  'Internal Review',
  'Client Review',
  'Delivered',
  'Closure Pending',
  'Closed',
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

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
  departmentName: string;
  goalId: string;
  goalTitle: string;
  clientName?: string;
  jobCode?: string;
  name: string;
  description?: string;
  ownerId?: string;
  ownerName?: string;
  memberIds: string[];
  memberNames: string[];
  startDate?: string;
  deadline?: string;
  status: ProjectStatus;
  budget?: number;
  totalTasks: number;
  doneTasks: number;
  progress: number;
}

export type ClosureItemKey =
  | 'FINAL_FORMATS_CHECKED'
  | 'DRIVE_CLOSURE_COMPLETED'
  | 'PORTFOLIO_GIF_CREATED'
  | 'PROJECT_PPT_COMPLETED'
  | 'PORTFOLIO_UPDATE_COMPLETED'
  | 'INVOICE_ACCOUNTS_NOTIFIED';

export interface ProjectClosureItem {
  id: string;
  key: ClosureItemKey;
  label: string;
  assignedMemberId?: string;
  assignedMemberName?: string;
  required: boolean;
  completed: boolean;
  completedAt?: string;
}

export interface ProjectDetail extends Project {
  closureItems: ProjectClosureItem[];
  actions: {
    id: string;
    code?: string;
    title: string;
    progress: number;
  }[];
  weekGoals: WeekGoal[];
  tasks: DailyTask[];
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
