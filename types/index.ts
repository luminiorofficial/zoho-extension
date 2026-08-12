export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentId: string;
  specialization?: string;
  avatar?: string;
}

export interface Action {
  id: string;
  goalId: string;
  title: string;
  description?: string;
  assignedMemberIds: string[];
  status: 'Not Started' | 'In Progress' | 'Done';
  progress: number;
  dueDate?: string;
  priority?: 'Low' | 'Medium' | 'High';
}

export interface Goal {
  id: string;
  departmentId: string;
  title: string;
  description?: string;
  progress: number;
  actions: Action[];
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  headId?: string;
  memberIds: string[];
  progress: number;
  isActive?: boolean;
  goals: Goal[];
}