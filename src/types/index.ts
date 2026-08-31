export type ActionStatus =
  | 'Not Started'
  | 'Started'
  | 'In Progress'
  | 'Done'
  | 'On Hold'
  | 'Cancelled';

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

export const CAPACITY_STATUSES = [
  'Available',
  'Normal',
  'Busy',
  'Overloaded',
] as const;

export type CapacityStatus = (typeof CAPACITY_STATUSES)[number];

export const ATTENDANCE_STATUSES = [
  'Present',
  'Half Day',
  'Approved Leave',
  'Absent',
  'Work on Holiday',
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type AvailabilityStatus = AttendanceStatus | 'Not Marked';

export const AVAILABILITY_STATUSES: AvailabilityStatus[] = [
  ...ATTENDANCE_STATUSES,
  'Not Marked',
];

export type LeaveRequestStatus = 'Pending' | 'Approved' | 'Rejected';

export type Priority =
  | 'Low'
  | 'Medium'
  | 'High'
  | 'Critical';

export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  team?: string;
  departmentId: string;
  departmentIds?: string[];
  specialization?: string;
  avatar?: string;
  isActive?: boolean;
}

export type PeriodType =
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'YEARLY';

export interface ReportingFilters {
  departmentId?: string;
  memberId?: string;
  goalId?: string;
  projectId?: string;
  keyId?: string;
  subGoalId?: string;
  taskId?: string;
  assignmentStatus?: KeyAssignmentStatus;
  assignmentStartDate?: string;
  assignmentEndDate?: string;
  periodType: PeriodType;
  periodDate: string;
}

export interface KpiReportRow {
  targetId: string;
  measurementId?: string;
  departmentId: string;
  departmentName: string;
  goalId: string;
  goalTitle: string;
  memberId?: string;
  title: string;
  targetValue?: number;
  targetUnit?: string;
  achievedValue?: number;
  progress?: number;
  note?: string;
}

export interface TaskReportSummary {
  totalTasks: number;
  doneTasks: number;
  progress: number;
}

export interface PeriodReview {
  id: string;
  departmentId?: string;
  departmentName?: string;
  memberId?: string;
  memberName?: string;
  goalId?: string;
  goalTitle?: string;
  periodType: PeriodType;
  periodStart: string;
  periodEnd: string;
  score?: number;
  summary?: string;
  achievements?: string;
  challenges?: string;
  nextSteps?: string;
  isImported: boolean;
}

export interface ReportingOption {
  id: string;
  name: string;
  departmentId?: string;
}

export interface ReportingData {
  filters: ReportingFilters;
  periodStart: string;
  periodEnd: string;
  departments: ReportingOption[];
  members: ReportingOption[];
  goals: ReportingOption[];
  projects: ReportingOption[];
  assignmentKeys: ReportingOption[];
  assignmentSubGoals: AssignmentReportingOption[];
  assignmentTasks: ReportingOption[];
  taskProgress: TaskReportSummary;
  kpis: KpiReportRow[];
  kpiProgress: number;
  reviews: PeriodReview[];
  keyAssignments: KeyAssignment[];
}

export interface PeriodProgress {
  periodType: PeriodType;
  periodStart: string;
  periodEnd: string;
  totalTasks: number;
  doneTasks: number;
  statusCounts: {
    done: number;
    inProgress: number;
    notStarted: number;
    onHold: number;
  };
  progress: number;
}

export interface Project {
  id: string;
  departmentId: string;
  departmentName: string;
  goalId: string;
  goalTitle: string;
  keys?: ProjectKey[];
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

export interface ProjectKey {
  id: string;
  code: string;
  title: string;
}

export interface ProjectAllocation {
  id: string;
  name: string;
  jobCode?: string;
  status: ProjectStatus;
  deadline?: string;
}

export interface MemberKeyAssignmentCounts {
  total: number;
  notStarted: number;
  inProgress: number;
  done: number;
  onHold: number;
  cancelled: number;
  overdue: number;
}

export interface MemberWorkload {
  memberId: string;
  memberName: string;
  email: string;
  role: string;
  departmentIds: string[];
  departmentNames: string[];
  activeProjectCount: number;
  openTaskCount: number;
  dueThisWeekTaskCount: number;
  completedThisWeekTaskCount: number;
  overdueTaskCount: number;
  capacityStatus: CapacityStatus;
  availabilityStatus: AvailabilityStatus;
  activeProjects: ProjectAllocation[];
  /** Member-wise workload from the key-wise assignment flow (key_assignments), via getUnifiedWorkReport. */
  keyAssignmentCounts: MemberKeyAssignmentCounts;
}

export interface AttendanceRecord {
  id: string;
  memberId: string;
  memberName: string;
  departmentIds: string[];
  departmentNames: string[];
  date: string;
  status: AttendanceStatus;
  note?: string;
  source: 'Manual' | 'Leave request' | 'Imported';
  isReadOnly: boolean;
}

export interface AttendanceSummary {
  todayStatus: AvailabilityStatus;
  counts: Record<AttendanceStatus, number>;
  history: AttendanceRecord[];
}

export interface DepartmentAttendanceMember {
  memberId: string;
  memberName: string;
  role: string;
  status: AvailabilityStatus;
}

export interface LeaveRequest {
  id: string;
  departmentId: string;
  departmentName: string;
  memberId: string;
  memberName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveRequestStatus;
  reviewerName?: string;
  reviewNote?: string;
  createdAt: string;
}

export interface AttendanceReviewer {
  memberId: string;
  memberName: string;
  departmentIds: string[];
  isAdmin: boolean;
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
  carriedForward?: boolean;
  actions: TaskAction[];
}

export interface TaskAction {
  id: string;
  taskId: string;
  title: string;
  status: ActionStatus;
}

export interface WeekGoal {
  id: string;
  title: string;
  description?: string;
  weekStart: string;
  weekEnd: string;
  goalId: string;
  goalTitle: string;
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

export interface DepartmentWorkData {
  projects: Project[];
  weekGoals: WeekGoal[];
  periodProgress: PeriodProgress[];
}

export interface MemberWorkData extends DepartmentWorkData {
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
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
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
  startDate?: string;
  isActive?: boolean;
}

export interface Goal {
  id: string;

  departmentId: string;

  ownerMemberId?: string;

  code?: string;

  title: string;

  description?: string;

  progress: number;

  status?: ActionStatus;

  startDate?: string;
  endDate?: string;

  isActive?: boolean;

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

/* =========================================================
 * KEY -> SUB GOAL -> PROJECT -> TASK -> MEMBER -> DATES
 *
 * A new, independent assignment flow. Does not reuse Goal/Action/WeekGoal.
 * ======================================================= */

export type AssignmentKeyCode = 'KEY_A' | 'KEY_B' | 'KEY_C';

export type KeyAssignmentStatus =
  | 'Not Started'
  | 'In Progress'
  | 'Done'
  | 'On Hold'
  | 'Cancelled';

export type KeyAssignmentStatusCode =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'ON_HOLD'
  | 'CANCELLED';

export interface AssignmentDailyStatus {
  id: string;
  assignmentId: string;
  workDate: string;
  status: KeyAssignmentStatusCode;
  note?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface AssignmentReportingOption extends ReportingOption {
  keyId: string;
}

export interface AssignmentSubGoal {
  id: string;
  keyId: string;
  title: string;
  description?: string;
  isActive: boolean;
}

export interface AssignmentKey {
  id: string;
  code: AssignmentKeyCode;
  title: string;
  subGoals: AssignmentSubGoal[];
}

export interface TaskMasterItem {
  id: string;
  category: string;
  title: string;
  isActive: boolean;
}

export interface AssignableProject {
  id: string;
  name: string;
  departmentId: string;
  departmentName: string;
}

export interface AssignableMember {
  id: string;
  name: string;
}

export interface KeyAssignment {
  id: string;
  keyId: string;
  keyCode: AssignmentKeyCode;
  keyTitle: string;
  subGoalId: string;
  subGoalTitle: string;
  projectId: string;
  projectName: string;
  departmentId: string;
  departmentName: string;
  taskId: string;
  taskCategory: string;
  taskTitle: string;
  memberId: string;
  memberName: string;
  startDate: string;
  endDate: string;
  status: KeyAssignmentStatus;
  dailyStatuses?: AssignmentDailyStatus[];
}

export interface UnifiedWorkReportItem {
  id: string;
  key: {
    id: string;
    code: AssignmentKeyCode;
    title: string;
  };
  subGoal: {
    id: string;
    title: string;
  };
  project: {
    id: string;
    name: string;
    departmentId: string;
    departmentName: string;
  };
  task: {
    id: string;
    category: string;
    title: string;
  };
  member: {
    id: string;
    name: string;
  };
  /** Team Alignment stores the canonical team label without a separate team table. */
  team: {
    id: string;
    name: string;
  } | null;
  department: {
    id: string;
    name: string;
  } | null;
  startDate: string;
  endDate: string;
  status: KeyAssignmentStatus;
  dailyStatuses: AssignmentDailyStatus[];
}

export interface UnifiedWorkReportFilters {
  /** The canonical Team Alignment team label. */
  teamId?: string;
  departmentId?: string;
  keyId?: string;
  subGoalId?: string;
  projectId?: string;
  taskId?: string;
  memberId?: string;
  status?: KeyAssignmentStatus;
  startDate?: string;
  endDate?: string;
  /** Include execution history without changing assignment-overlap filtering. */
  includeDailyStatuses?: boolean;
  dailyStatusStartDate?: string;
  dailyStatusEndDate?: string;
}

export type KeyAssignmentFilters = UnifiedWorkReportFilters;
