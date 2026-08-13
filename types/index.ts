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
