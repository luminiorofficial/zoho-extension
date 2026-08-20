import 'server-only';

import type { QueryResultRow } from 'pg';

import { db } from '@/lib/db';
import { CLOSURE_ITEM_LABELS } from '@/lib/project-constants';

import type {
  ActionStatus,
  ClosureItemKey,
  DailyTask,
  Project,
  ProjectClosureItem,
  ProjectDetail,
  ProjectStatus,
  WeekGoal,
} from '@/types';

/* =========================================================
 * DATABASE ROW TYPES
 * ======================================================= */

interface ProjectRow extends QueryResultRow {
  id: string;

  department_id: string;
  department_name: string;

  goal_id: string;
  goal_title: string;

  client_name: string | null;
  code: string | null;
  name: string;
  description: string | null;

  owner_member_id: string | null;
  owner_member_name: string | null;

  member_ids: string[];
  member_names: string[];

  start_date: string | Date | null;
  end_date: string | Date | null;

  status: string;
  budget: string | null;

  total_tasks: number;
  done_tasks: number;
  progress_percent: string;
}

interface WeekGoalRow extends QueryResultRow {
  id: string;

  title: string;
  description: string | null;

  week_start: string | Date;
  week_end: string | Date;

  action_id: string;
  action_title: string;

  project_id: string;
  project_name: string;

  assigned_member_id: string;
  assigned_member_name: string;

  total_tasks: number;
  done_tasks: number;
  progress_percent: string;
}

interface TaskRow extends QueryResultRow {
  id: string;

  week_goal_id: string;
  week_goal_title: string;

  action_id: string;
  action_title: string;

  project_id: string;
  project_name: string;

  assigned_member_id: string;

  task_date: string | Date;

  title: string;
  description: string | null;

  status: string;

  carried_forward: boolean;
}

interface ClosureItemRow extends QueryResultRow {
  id: string;
  item_key: ClosureItemKey;

  assigned_member_id: string | null;
  assigned_member_name: string | null;

  is_required: boolean;
  is_completed: boolean;

  completed_at: string | Date | null;
}

interface ProjectActionRow extends QueryResultRow {
  id: string;
  code: string | null;
  title: string;
  progress_percent: string;
}

interface DepartmentOptionRow extends QueryResultRow {
  id: string;
  name: string;

  goals: {
    id: string;
    title: string;
    code: string | null;
  }[];
}

interface ActiveMemberRow extends QueryResultRow {
  id: string;
  name: string;
  current_department_id: string | null;
}

/* =========================================================
 * PAGE CONTEXT TYPES
 * ======================================================= */

export interface ProjectPageDepartment {
  id: string;
  name: string;

  goals: {
    id: string;
    title: string;
    code?: string;
  }[];

  memberIds: string[];
}

export interface ProjectPageContext {
  departments: ProjectPageDepartment[];

  members: {
    id: string;
    name: string;
  }[];

  activeMemberIds: string[];
}

/* =========================================================
 * HELPERS
 * ======================================================= */

function dateString(
  value: string | Date,
): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  const year = value.getFullYear();

  const month = String(
    value.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    value.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function mapProjectStatus(
  status: string,
): ProjectStatus {
  const statuses: Record<
    string,
    ProjectStatus
  > = {
    PLANNED: 'Planned',
    ACTIVE: 'Active',
    INTERNAL_REVIEW: 'Internal Review',
    CLIENT_REVIEW: 'Client Review',
    DELIVERED: 'Delivered',
    CLOSURE_PENDING: 'Closure Pending',
    CLOSED: 'Closed',
  };

  return statuses[status] ?? 'Planned';
}

function mapTaskStatus(
  status: string,
): ActionStatus {
  if (status === 'DONE') {
    return 'Done';
  }

  if (status === 'IN_PROGRESS') {
    return 'In Progress';
  }

  if (status === 'ON_HOLD') {
    return 'On Hold';
  }

  if (status === 'CANCELLED') {
    return 'Cancelled';
  }

  return 'Not Started';
}

function mapProject(
  row: ProjectRow,
): Project {
  return {
    id: row.id,

    departmentId:
      row.department_id,

    departmentName:
      row.department_name,

    goalId:
      row.goal_id,

    goalTitle:
      row.goal_title,

    clientName:
      row.client_name ??
      undefined,

    jobCode:
      row.code ??
      undefined,

    name:
      row.name,

    description:
      row.description ??
      undefined,

    ownerId:
      row.owner_member_id ??
      undefined,

    ownerName:
      row.owner_member_name ??
      undefined,

    memberIds:
      row.member_ids,

    memberNames:
      row.member_names,

    startDate:
      row.start_date
        ? dateString(
            row.start_date,
          )
        : undefined,

    deadline:
      row.end_date
        ? dateString(
            row.end_date,
          )
        : undefined,

    status:
      mapProjectStatus(
        row.status,
      ),

    budget:
      row.budget === null
        ? undefined
        : Number(
            row.budget,
          ),

    totalTasks:
      Number(
        row.total_tasks,
      ),

    doneTasks:
      Number(
        row.done_tasks,
      ),

    progress:
      Number(
        row.progress_percent,
      ),
  };
}

function mapTask(
  row: TaskRow,
): DailyTask {
  return {
    id:
      row.id,

    weekGoalId:
      row.week_goal_id,

    weekGoalTitle:
      row.week_goal_title,

    actionId:
      row.action_id,

    actionTitle:
      row.action_title,

    projectId:
      row.project_id,

    projectName:
      row.project_name,

    assignedMemberId:
      row.assigned_member_id,

    taskDate:
      dateString(
        row.task_date,
      ),

    title:
      row.title,

    description:
      row.description ??
      undefined,

    status:
      mapTaskStatus(
        row.status,
      ),

    carriedForward:
      row.carried_forward,
  };
}

/* =========================================================
 * LIGHTWEIGHT PROJECT PAGE CONTEXT
 *
 * Replaces getStructureData() on project pages.
 *
 * We only fetch:
 * - active departments
 * - active goals
 * - active members
 *
 * We DO NOT fetch:
 * - targets
 * - actions
 * - action assignees
 * - department progress hierarchy
 * ======================================================= */

export async function getProjectPageContext():
Promise<ProjectPageContext> {
  const [
    departmentResult,
    memberResult,
  ] = await Promise.all([
    db.query<DepartmentOptionRow>(
      `
      SELECT
        d.id,
        d.name,

        COALESCE(
          JSONB_AGG(
            JSONB_BUILD_OBJECT(
              'id', g.id,
              'title', g.title,
              'code', g.code
            )
            ORDER BY
              g.code NULLS LAST,
              g.title
          )
          FILTER (
            WHERE g.id IS NOT NULL
          ),
          '[]'::jsonb
        ) AS goals

      FROM departments d

      LEFT JOIN goals g
        ON g.department_id = d.id
       AND g.is_active = TRUE

      WHERE
        d.is_active = TRUE

      GROUP BY
        d.id,
        d.name

      ORDER BY
        d.name
      `,
    ),

    db.query<ActiveMemberRow>(
      `
      SELECT
        id,
        name,
        current_department_id

      FROM members

      WHERE
        is_active = TRUE

      ORDER BY
        name,
        id
      `,
    ),
  ]);

  const memberIdsByDepartment =
    new Map<
      string,
      string[]
    >();

  for (
    const member
    of memberResult.rows
  ) {
    if (
      !member.current_department_id
    ) {
      continue;
    }

    const current =
      memberIdsByDepartment.get(
        member.current_department_id,
      );

    if (current) {
      current.push(
        member.id,
      );
    } else {
      memberIdsByDepartment.set(
        member.current_department_id,
        [
          member.id,
        ],
      );
    }
  }

  const departments:
    ProjectPageDepartment[] =
    departmentResult.rows.map(
      (department) => ({
        id:
          department.id,

        name:
          department.name,

        goals:
          department.goals.map(
            (goal) => ({
              id:
                goal.id,

              title:
                goal.title,

              code:
                goal.code ??
                undefined,
            }),
          ),

        memberIds:
          memberIdsByDepartment.get(
            department.id,
          ) ?? [],
      }),
    );

  return {
    departments,

    members:
      memberResult.rows.map(
        (member) => ({
          id:
            member.id,

          name:
            member.name,
        }),
      ),

    activeMemberIds:
      memberResult.rows.map(
        (member) =>
          member.id,
      ),
  };
}

/* =========================================================
 * OPTIMIZED PROJECT DETAIL
 *
 * BEFORE:
 *
 * getProjects(null, null)
 * -> fetch every project
 * -> JS .find(projectId)
 *
 * getWeekGoals(departmentId, null)
 * -> fetch department's goals/tasks
 * -> JS filter(projectId)
 *
 * AFTER:
 *
 * Every query below contains:
 * WHERE project_id = $1
 *
 * ======================================================= */

export async function getProjectDetailOptimized(
  projectId: string,
): Promise<ProjectDetail | null> {
  /* -------------------------------------------------------
   * 1. Load ONLY the requested project
   * ----------------------------------------------------- */

  const projectResult =
    await db.query<ProjectRow>(
      `
      SELECT
        p.id,

        p.department_id,
        d.name
          AS department_name,

        p.goal_id,
        g.title
          AS goal_title,

        p.client_name,
        p.code,
        p.name,
        p.description,

        p.owner_member_id,
        owner.name
          AS owner_member_name,

        ARRAY(
          SELECT
            pm.member_id

          FROM project_members pm

          JOIN members member_record
            ON member_record.id =
               pm.member_id

          WHERE
            pm.project_id = p.id

          ORDER BY
            member_record.name,
            member_record.id
        ) AS member_ids,

        ARRAY(
          SELECT
            member_record.name

          FROM project_members pm

          JOIN members member_record
            ON member_record.id =
               pm.member_id

          WHERE
            pm.project_id = p.id

          ORDER BY
            member_record.name,
            member_record.id
        ) AS member_names,

        p.start_date,
        p.end_date,
        p.status,
        p.budget,

        COALESCE(
          ptp.total_tasks,
          0
        ) AS total_tasks,

        COALESCE(
          ptp.done_tasks,
          0
        ) AS done_tasks,

        COALESCE(
          ptp.progress_percent,
          0
        ) AS progress_percent

      FROM projects p

      JOIN departments d
        ON d.id =
           p.department_id

      JOIN goals g
        ON g.id =
           p.goal_id

      LEFT JOIN members owner
        ON owner.id =
           p.owner_member_id

      LEFT JOIN project_task_progress ptp
        ON ptp.project_id =
           p.id

      WHERE
        p.id = $1
        AND p.is_active = TRUE

      LIMIT 1
      `,
      [
        projectId,
      ],
    );

  const projectRow =
    projectResult.rows[0];

  if (!projectRow) {
    return null;
  }

  /* -------------------------------------------------------
   * 2. Everything below is restricted to THIS project
   * ----------------------------------------------------- */

  const [
    closureResult,
    actionResult,
    weekGoalResult,
    taskResult,
  ] = await Promise.all([
    /* -----------------------------------------------------
     * Closure checklist
     * --------------------------------------------------- */

    db.query<ClosureItemRow>(
      `
      SELECT
        pci.id,
        pci.item_key,

        pci.assigned_member_id,

        m.name
          AS assigned_member_name,

        pci.is_required,
        pci.is_completed,
        pci.completed_at

      FROM project_closure_items pci

      LEFT JOIN members m
        ON m.id =
           pci.assigned_member_id

      WHERE
        pci.project_id = $1

      ORDER BY
        pci.created_at,
        pci.item_key
      `,
      [
        projectId,
      ],
    ),

    /* -----------------------------------------------------
     * Actions actually used by this project
     * --------------------------------------------------- */

    db.query<ProjectActionRow>(
      `
      SELECT DISTINCT
        a.id,
        a.code,
        a.title,

        COALESCE(
          atp.progress_percent,
          a.progress_percent
        ) AS progress_percent

      FROM week_goals wg

      JOIN actions a
        ON a.id =
           wg.action_id

      LEFT JOIN action_task_progress atp
        ON atp.action_id =
           a.id

      WHERE
        wg.project_id = $1

      ORDER BY
        a.code NULLS LAST,
        a.title
      `,
      [
        projectId,
      ],
    ),

    /* -----------------------------------------------------
     * Weekly goals ONLY for this project
     * --------------------------------------------------- */

    db.query<WeekGoalRow>(
      `
      SELECT
        wg.id,
        wg.title,
        wg.description,
        wg.week_start,

        (
          wg.week_start + 4
        ) AS week_end,

        wg.action_id,
        a.title
          AS action_title,

        wg.project_id,
        p.name
          AS project_name,

        wg.assigned_member_id,
        m.name
          AS assigned_member_name,

        COALESCE(
          wgp.total_tasks,
          0
        ) AS total_tasks,

        COALESCE(
          wgp.done_tasks,
          0
        ) AS done_tasks,

        COALESCE(
          wgp.progress_percent,
          0
        ) AS progress_percent

      FROM week_goals wg

      JOIN actions a
        ON a.id =
           wg.action_id

      JOIN projects p
        ON p.id =
           wg.project_id

      JOIN members m
        ON m.id =
           wg.assigned_member_id

      LEFT JOIN week_goal_progress wgp
        ON wgp.week_goal_id =
           wg.id

      WHERE
        wg.project_id = $1

      ORDER BY
        wg.week_start DESC,
        m.name,
        wg.title
      `,
      [
        projectId,
      ],
    ),

    /* -----------------------------------------------------
     * Tasks ONLY for this project
     * --------------------------------------------------- */

    db.query<TaskRow>(
      `
      SELECT
        t.id,

        t.week_goal_id,
        wg.title
          AS week_goal_title,

        t.action_id,
        a.title
          AS action_title,

        t.project_id,
        p.name
          AS project_name,

        t.assigned_member_id,

        t.task_date,

        t.title,
        t.description,
        t.status,

        EXISTS (
          SELECT 1

          FROM tasks carried

          WHERE
            carried.carried_from_task_id =
              t.id
        ) AS carried_forward

      FROM tasks t

      JOIN week_goals wg
        ON wg.id =
           t.week_goal_id

      JOIN actions a
        ON a.id =
           t.action_id

      JOIN projects p
        ON p.id =
           t.project_id

      WHERE
        t.project_id = $1

      ORDER BY
        t.task_date DESC,
        t.created_at DESC
      `,
      [
        projectId,
      ],
    ),
  ]);

  /* -------------------------------------------------------
   * Map project
   * ----------------------------------------------------- */

  const project =
    mapProject(
      projectRow,
    );

  /* -------------------------------------------------------
   * Map tasks
   * ----------------------------------------------------- */

  const tasks:
    DailyTask[] =
    taskResult.rows.map(
      mapTask,
    );

  const tasksByWeekGoal =
    new Map<
      string,
      DailyTask[]
    >();

  for (
    const task
    of tasks
  ) {
    const current =
      tasksByWeekGoal.get(
        task.weekGoalId,
      );

    if (current) {
      current.push(
        task,
      );
    } else {
      tasksByWeekGoal.set(
        task.weekGoalId,
        [
          task,
        ],
      );
    }
  }

  /* -------------------------------------------------------
   * Map weekly goals
   * ----------------------------------------------------- */

  const weekGoals:
    WeekGoal[] =
    weekGoalResult.rows.map(
      (row) => ({
        id:
          row.id,

        title:
          row.title,

        description:
          row.description ??
          undefined,

        weekStart:
          dateString(
            row.week_start,
          ),

        weekEnd:
          dateString(
            row.week_end,
          ),

        actionId:
          row.action_id,

        actionTitle:
          row.action_title,

        projectId:
          row.project_id,

        projectName:
          row.project_name,

        assignedMemberId:
          row.assigned_member_id,

        assignedMemberName:
          row.assigned_member_name,

        totalTasks:
          Number(
            row.total_tasks,
          ),

        doneTasks:
          Number(
            row.done_tasks,
          ),

        progress:
          Number(
            row.progress_percent,
          ),

        tasks:
          tasksByWeekGoal.get(
            row.id,
          ) ?? [],
      }),
    );

  /* -------------------------------------------------------
   * Closure
   * ----------------------------------------------------- */

  const closureItems:
    ProjectClosureItem[] =
    closureResult.rows.map(
      (row) => ({
        id:
          row.id,

        key:
          row.item_key,

        label:
          CLOSURE_ITEM_LABELS[
            row.item_key
          ],

        assignedMemberId:
          row.assigned_member_id ??
          undefined,

        assignedMemberName:
          row.assigned_member_name ??
          undefined,

        required:
          row.is_required,

        completed:
          row.is_completed,

        completedAt:
          row.completed_at
            ? new Date(
                row.completed_at,
              ).toISOString()
            : undefined,
      }),
    );

  return {
    ...project,

    closureItems,

    actions:
      actionResult.rows.map(
        (row) => ({
          id:
            row.id,

          code:
            row.code ??
            undefined,

          title:
            row.title,

          progress:
            Number(
              row.progress_percent,
            ),
        }),
      ),

    weekGoals,

    tasks,
  };
}