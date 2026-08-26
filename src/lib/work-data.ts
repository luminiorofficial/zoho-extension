import 'server-only';

import type { QueryResultRow } from 'pg';

import { db } from '@/lib/db';
import { CLOSURE_ITEM_LABELS } from '@/lib/project-constants';

import type {
  ActionStatus,
  ClosureItemKey,
  DailyTask,
  DepartmentWorkData,
  MemberWorkData,
  PeriodProgress,
  PeriodType,
  Project,
  ProjectClosureItem,
  ProjectDetail,
  ProjectStatus,
  WeekGoal,
  WorkActionOption,
} from '@/types';

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

interface PeriodProgressRow extends QueryResultRow {
  period_type: PeriodType;
  period_start: string | Date;
  period_end: string | Date;
  total_tasks: number;
  done_tasks: number;
  in_progress_tasks: number;
  not_started_tasks: number;
  on_hold_tasks: number;
  progress_percent: string;
}

interface WorkActionRow extends QueryResultRow {
  id: string;
  goal_id: string;
  goal_title: string;
  title: string;
  code: string | null;
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

function mapStatus(status: string): ActionStatus {
  if (status === 'DONE') {
    return 'Done';
  }

  if (status === 'IN_PROGRESS') {
    return 'In Progress';
  }

  return 'Not Started';
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
    INTERNAL_REVIEW:
      'Internal Review',
    CLIENT_REVIEW: 'Client Review',
    DELIVERED: 'Delivered',
    CLOSURE_PENDING:
      'Closure Pending',
    CLOSED: 'Closed',
  };

  return statuses[status] ?? 'Planned';
}

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
      row.client_name ?? undefined,

    jobCode:
      row.code ?? undefined,

    name:
      row.name,

    description:
      row.description ?? undefined,

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
        : Number(row.budget),

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
      row.description ?? undefined,

    status:
      mapStatus(
        row.status,
      ),

    carriedForward:
      row.carried_forward,
  };
}

export async function getProjects(
  departmentId: string | null,
  memberId: string | null,
): Promise<Project[]> {
  const result =
    await db.query<ProjectRow>(
      `
      SELECT
        p.id,
        p.department_id,
        d.name AS department_name,

        p.goal_id,
        g.title AS goal_title,

        p.client_name,
        p.code,
        p.name,
        p.description,

        p.owner_member_id,
        owner.name AS owner_member_name,

        ARRAY(
          SELECT pm.member_id
          FROM project_members pm

          JOIN members member_record
            ON member_record.id =
               pm.member_id

          WHERE pm.project_id = p.id

          ORDER BY
            member_record.name,
            member_record.id
        ) AS member_ids,

        ARRAY(
          SELECT member_record.name
          FROM project_members pm

          JOIN members member_record
            ON member_record.id =
               pm.member_id

          WHERE pm.project_id = p.id

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
        p.is_active = TRUE

        AND (
          $1::uuid IS NULL
          OR p.department_id = $1
        )

        AND (
          $2::uuid IS NULL

          OR EXISTS (
            SELECT 1
            FROM project_members pm

            WHERE
              pm.project_id = p.id
              AND pm.member_id = $2
          )
        )

      ORDER BY
        d.name,
        p.name
      `,
      [
        departmentId,
        memberId,
      ],
    );

  return result.rows.map(
    mapProject,
  );
}

async function getWeekGoals(
  departmentId: string | null,
  memberId: string | null,
): Promise<{
  weekGoals: WeekGoal[];
  tasks: DailyTask[];
}> {
  const [
    weekGoalResult,
    taskResult,
  ] = await Promise.all([
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
        a.title AS action_title,

        wg.project_id,
        p.name AS project_name,

        wg.assigned_member_id,
        m.name AS assigned_member_name,

        wgp.total_tasks,
        wgp.done_tasks,
        wgp.progress_percent

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

      JOIN week_goal_progress wgp
        ON wgp.week_goal_id =
           wg.id

      WHERE
        (
          $1::uuid IS NULL
          OR wg.department_id = $1
        )

        AND (
          $2::uuid IS NULL
          OR wg.assigned_member_id = $2
        )

      ORDER BY
        wg.week_start DESC,
        m.name,
        wg.title
      `,
      [
        departmentId,
        memberId,
      ],
    ),

    db.query<TaskRow>(
      `
      SELECT
        t.id,

        t.week_goal_id,
        wg.title AS week_goal_title,

        t.action_id,
        a.title AS action_title,

        t.project_id,
        p.name AS project_name,

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
        (
          $1::uuid IS NULL
          OR wg.department_id = $1
        )

        AND (
          $2::uuid IS NULL
          OR t.assigned_member_id = $2
        )

      ORDER BY
        t.task_date DESC,
        t.created_at DESC
      `,
      [
        departmentId,
        memberId,
      ],
    ),
  ]);

  const tasks =
    taskResult.rows.map(
      mapTask,
    );

  const tasksByWeekGoal =
    new Map<
      string,
      DailyTask[]
    >();

  for (const task of tasks) {
    const existing =
      tasksByWeekGoal.get(
        task.weekGoalId,
      );

    if (existing) {
      existing.push(task);
    } else {
      tasksByWeekGoal.set(
        task.weekGoalId,
        [task],
      );
    }
  }

  const weekGoals: WeekGoal[] =
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

  return {
    weekGoals,
    tasks,
  };
}

async function getCurrentProgress(
  departmentId: string | null,
  memberId: string | null,
): Promise<PeriodProgress[]> {
  const result =
    await db.query<PeriodProgressRow>(
      `
      WITH current_periods AS (
        SELECT
          period_type,
          period_start,
          period_end

        FROM (
          VALUES

          (
            'WEEKLY'::varchar(30),

            DATE_TRUNC(
              'week',
              CURRENT_DATE
            )::date,

            (
              DATE_TRUNC(
                'week',
                CURRENT_DATE
              )::date + 6
            )
          ),

          (
            'MONTHLY'::varchar(30),

            DATE_TRUNC(
              'month',
              CURRENT_DATE
            )::date,

            (
              DATE_TRUNC(
                'month',
                CURRENT_DATE
              )
              + INTERVAL
                '1 month - 1 day'
            )::date
          ),

          (
            'QUARTERLY'::varchar(30),

            (
              DATE_TRUNC(
                'quarter',
                CURRENT_DATE
                - INTERVAL
                  '3 months'
              )
              + INTERVAL
                '3 months'
            )::date,

            (
              DATE_TRUNC(
                'quarter',
                CURRENT_DATE
                - INTERVAL
                  '3 months'
              )
              + INTERVAL
                '6 months - 1 day'
            )::date
          ),

          (
            'YEARLY'::varchar(30),

            (
              DATE_TRUNC(
                'year',
                CURRENT_DATE
                - INTERVAL
                  '3 months'
              )
              + INTERVAL
                '3 months'
            )::date,

            (
              DATE_TRUNC(
                'year',
                CURRENT_DATE
                - INTERVAL
                  '3 months'
              )
              + INTERVAL
                '15 months - 1 day'
            )::date
          )

        ) AS value(
          period_type,
          period_start,
          period_end
        )
      ),

      period_status_counts AS (
        SELECT
          cp.period_type,
          cp.period_start,

          COUNT(
            tre.task_id
          ) FILTER (
            WHERE
              tre.status =
                'DONE'
          )::integer
            AS done_tasks,

          COUNT(
            tre.task_id
          ) FILTER (
            WHERE
              tre.status =
                'IN_PROGRESS'
          )::integer
            AS in_progress_tasks,

          COUNT(
            tre.task_id
          ) FILTER (
            WHERE
              tre.status =
                'NOT_STARTED'
          )::integer
            AS not_started_tasks,

          COUNT(
            tre.task_id
          ) FILTER (
            WHERE
              tre.status =
                'ON_HOLD'
          )::integer
            AS on_hold_tasks

        FROM current_periods cp

        LEFT JOIN task_reporting_entries tre
          ON tre.period_type =
             cp.period_type

         AND tre.period_start =
             cp.period_start

         AND (
           $1::uuid IS NULL
           OR tre.department_id = $1
         )

         AND (
           $2::uuid IS NULL
           OR tre.member_id = $2
         )

        GROUP BY
          cp.period_type,
          cp.period_start
      )

      SELECT
        cp.period_type,
        cp.period_start,
        cp.period_end,

        COALESCE(
          SUM(
            tpp.total_tasks
          ),
          0
        )::integer
          AS total_tasks,

        COALESCE(
          SUM(
            tpp.done_tasks
          ),
          0
        )::integer
          AS done_tasks,

        COALESCE(
          psc.in_progress_tasks,
          0
        )::integer
          AS in_progress_tasks,

        COALESCE(
          psc.not_started_tasks,
          0
        )::integer
          AS not_started_tasks,

        COALESCE(
          psc.on_hold_tasks,
          0
        )::integer
          AS on_hold_tasks,

        COALESCE(
          ROUND(
            SUM(
              tpp.progress_percent
              * tpp.total_tasks
            )
            /
            NULLIF(
              SUM(
                tpp.total_tasks
              ),
              0
            ),
            2
          ),
          0
        ) AS progress_percent

      FROM current_periods cp

      LEFT JOIN task_period_progress tpp
        ON tpp.period_type =
           cp.period_type

       AND tpp.period_start =
           cp.period_start

       AND (
         $1::uuid IS NULL
         OR tpp.department_id = $1
       )

       AND (
         $2::uuid IS NULL
         OR tpp.member_id = $2
       )

      LEFT JOIN period_status_counts psc
        ON psc.period_type =
           cp.period_type

       AND psc.period_start =
           cp.period_start

      GROUP BY
        cp.period_type,
        cp.period_start,
        cp.period_end,
        psc.in_progress_tasks,
        psc.not_started_tasks,
        psc.on_hold_tasks

      ORDER BY
        CASE
          cp.period_type

          WHEN 'WEEKLY'
            THEN 1

          WHEN 'MONTHLY'
            THEN 2

          WHEN 'QUARTERLY'
            THEN 3

          WHEN 'YEARLY'
            THEN 4
        END
      `,
      [
        departmentId,
        memberId,
      ],
    );

  return result.rows.map(
    (row) => ({
      periodType:
        row.period_type,

      periodStart:
        dateString(
          row.period_start,
        ),

      periodEnd:
        dateString(
          row.period_end,
        ),

      totalTasks:
        Number(
          row.total_tasks,
        ),

      doneTasks:
        Number(
          row.done_tasks,
        ),

      statusCounts: {
        done:
          Number(
            row.done_tasks,
          ),

        inProgress:
          Number(
            row.in_progress_tasks,
          ),

        notStarted:
          Number(
            row.not_started_tasks,
          ),

        onHold:
          Number(
            row.on_hold_tasks,
          ),
      },

      progress:
        Number(
          row.progress_percent,
        ),
    }),
  );
}

export async function getDepartmentWorkData(
  departmentId: string,
): Promise<DepartmentWorkData> {
  const [
    projects,
    execution,
    periodProgress,
  ] = await Promise.all([
    getProjects(
      departmentId,
      null,
    ),

    getWeekGoals(
      departmentId,
      null,
    ),

    getCurrentProgress(
      departmentId,
      null,
    ),
  ]);

  return {
    projects,

    weekGoals:
      execution.weekGoals,

    periodProgress,
  };
}

export async function getMemberWorkData(
  memberId: string,
): Promise<MemberWorkData> {
  /*
   * Important:
   *
   * The member's project list already comes from
   * project_members inside getProjects().
   *
   * Therefore we should NOT filter those projects again
   * by action.goalId here.
   *
   * That additional filter was causing valid assigned
   * projects to disappear from Weekly Planner and made
   * "Add Weekly Goal" disabled for every member.
   */
  const [
    projects,
    execution,
    periodProgress,
    actionResult,
  ] = await Promise.all([
    getProjects(
      null,
      memberId,
    ),

    getWeekGoals(
      null,
      memberId,
    ),

    getCurrentProgress(
      null,
      memberId,
    ),

    db.query<WorkActionRow>(
      `
      SELECT DISTINCT
        a.id,
        a.goal_id,
        g.title AS goal_title,
        a.title,
        a.code

      FROM actions a

      JOIN goals g
        ON g.id =
           a.goal_id

      JOIN departments d
        ON d.id =
           g.department_id

      JOIN action_assignees aa
        ON aa.action_id =
           a.id

      JOIN members m
        ON m.id =
           aa.member_id

      WHERE
        aa.member_id = $1

        AND a.is_active = TRUE
        AND g.is_active = TRUE
        AND d.is_active = TRUE
        AND m.is_active = TRUE

      ORDER BY
        g.title,
        a.code NULLS LAST,
        a.title
      `,
      [
        memberId,
      ],
    ),
  ]);

  const actions:
    WorkActionOption[] =
    actionResult.rows.map(
      (row) => ({
        id:
          row.id,

        goalId:
          row.goal_id,

        goalTitle:
          row.goal_title,

        title:
          row.title,

        code:
          row.code ??
          undefined,
      }),
    );

  /*
   * Weekly Planner should receive every active planning
   * project assigned to this member.
   *
   * Action compatibility is handled by WeeklyPlanner and
   * again by /api/week-goals before saving.
   */
  const planningProjects =
    projects.filter(
      (project) =>
        [
          'Planned',
          'Active',
          'Internal Review',
          'Client Review',
        ].includes(
          project.status,
        ),
    );

  return {
    projects:
      planningProjects,

    actions,

    weekGoals:
      execution.weekGoals,

    tasks:
      execution.tasks,

    periodProgress,
  };
}

export async function getProjectDetail(
  projectId: string,
): Promise<ProjectDetail | null> {
  const projects =
    await getProjects(
      null,
      null,
    );

  const project =
    projects.find(
      (item) =>
        item.id === projectId,
    );

  if (!project) {
    return null;
  }

  const [
    execution,
    closureResult,
    actionResult,
  ] = await Promise.all([
    getWeekGoals(
      project.departmentId,
      null,
    ),

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
  ]);

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

    weekGoals:
      execution.weekGoals.filter(
        (weekGoal) =>
          weekGoal.projectId ===
          projectId,
      ),

    tasks:
      execution.tasks.filter(
        (task) =>
          task.projectId ===
          projectId,
      ),
  };
}