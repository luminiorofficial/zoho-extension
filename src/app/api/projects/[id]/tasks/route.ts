import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import {
  addDays,
  isDate,
  isoWeekStart,
  isUuid,
  textValue,
} from '@/lib/planner-validation';

interface ProjectTaskPayload {
  memberId?: unknown;
  title?: unknown;
  description?: unknown;
  taskDate?: unknown;
}

interface HierarchyRow {
  department_id: string;
  goal_id: string;
  project_name: string;
  member_name: string;
  action_id: string;
  action_title: string;
}

interface InsertedTaskRow {
  id: string;
  taskDate: string;
  title: string;
  description: string | null;
}

export async function POST(
  request: Request,
  context: RouteContext<'/api/projects/[id]/tasks'>,
) {
  const { id: projectId } = await context.params;

  if (!isUuid(projectId)) {
    return Response.json(
      { error: 'Invalid project id.' },
      { status: 400 },
    );
  }

  let payload: ProjectTaskPayload;

  try {
    payload = await request.json() as ProjectTaskPayload;
  } catch {
    return Response.json(
      { error: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const title = textValue(payload.title, 500);

  const description =
    payload.description === undefined
      ? ''
      : textValue(payload.description, 5000);

  if (
    !isUuid(payload.memberId)
    || !isDate(payload.taskDate)
    || !title
    || description === null
  ) {
    return Response.json(
      {
        error:
          'Assignee, task title, and task date are required.',
      },
      { status: 400 },
    );
  }

  const taskWeekStart = isoWeekStart(payload.taskDate);

  const client = await db.connect();

  let transactionOpen = false;

  try {
    await client.query('BEGIN');
    transactionOpen = true;

    // -------------------------------------------------------
    // Current week
    // -------------------------------------------------------

    const currentWeekResult =
      await client.query<{ week_start: string }>(
        `
        SELECT
          DATE_TRUNC(
            'week',
            CURRENT_DATE
          )::date::text AS week_start
        `,
      );

    const currentWeekStart =
      currentWeekResult.rows[0].week_start;

    const currentWeekFriday =
      addDays(currentWeekStart, 4);

    if (
      taskWeekStart !== currentWeekStart
      || payload.taskDate > currentWeekFriday
    ) {
      await client.query('ROLLBACK');
      transactionOpen = false;

      return Response.json(
        {
          error:
            'Tasks can only be added for Monday–Friday of the current week.',
        },
        { status: 400 },
      );
    }

    // -------------------------------------------------------
    // Validate:
    //
    // Project
    //   -> project member
    //   -> department member
    //   -> project goal
    //   -> compatible assigned action
    //
    // Prefer GENERAL action because database/014 creates
    // GENERAL for KEY A / KEY B / KEY C.
    // -------------------------------------------------------

    const hierarchyResult =
      await client.query<HierarchyRow>(
        `
        SELECT
          p.department_id,
          p.goal_id,
          p.name AS project_name,

          m.name AS member_name,

          selected_action.id
            AS action_id,

          selected_action.title
            AS action_title

        FROM projects p

        JOIN project_members pm
          ON pm.project_id = p.id
         AND pm.member_id = $2

        JOIN department_members dm
          ON dm.department_id = p.department_id
         AND dm.member_id = $2

        JOIN members m
          ON m.id = $2
         AND m.is_active = TRUE

        JOIN departments d
          ON d.id = p.department_id
         AND d.is_active = TRUE

        JOIN goals g
          ON g.id = p.goal_id
         AND g.department_id = p.department_id
         AND g.is_active = TRUE

        JOIN LATERAL (
          SELECT
            a.id,
            a.title,
            a.code

          FROM actions a

          JOIN action_assignees aa
            ON aa.action_id = a.id
           AND aa.member_id = $2

          WHERE
            a.goal_id = p.goal_id
            AND a.is_active = TRUE

          ORDER BY
            CASE
              WHEN UPPER(
                COALESCE(a.code, '')
              ) = 'GENERAL'
                THEN 0
              ELSE 1
            END,

            a.code NULLS LAST,
            a.title

          LIMIT 1
        ) selected_action
          ON TRUE

        WHERE
          p.id = $1

          AND p.is_active = TRUE

          AND p.status IN (
            'PLANNED',
            'ACTIVE',
            'INTERNAL_REVIEW',
            'CLIENT_REVIEW'
          )

        LIMIT 1
        `,
        [
          projectId,
          payload.memberId,
        ],
      );

    const hierarchy =
      hierarchyResult.rows[0];

    if (!hierarchy) {
      await client.query('ROLLBACK');
      transactionOpen = false;

      return Response.json(
        {
          error:
            'This member cannot receive a task for this project. Make sure the member is assigned to the project and has an active action under the project KEY / Goal.',
        },
        { status: 400 },
      );
    }

    // -------------------------------------------------------
    // Create/reuse current week plan
    // -------------------------------------------------------

    const weekPlanResult =
      await client.query<{ id: string }>(
        `
        INSERT INTO week_plans (
          department_id,
          member_id,
          week_start
        )

        VALUES (
          $1,
          $2,
          $3
        )

        ON CONFLICT (
          department_id,
          member_id,
          week_start
        )

        DO UPDATE SET
          updated_at = NOW()

        RETURNING id
        `,
        [
          hierarchy.department_id,
          payload.memberId,
          currentWeekStart,
        ],
      );

    const weekPlanId =
      weekPlanResult.rows[0].id;

    // -------------------------------------------------------
    // Create/reuse automatic project weekly goal
    //
    // This removes the requirement for the client to first
    // manually create a Weekly Goal before adding a task.
    // -------------------------------------------------------

    const automaticWeekGoalTitle =
      `Project Tasks · ${hierarchy.project_name}`;

    const weekGoalResult =
      await client.query<{ id: string }>(
        `
        INSERT INTO week_goals (
          week_plan_id,
          department_id,
          assigned_member_id,
          goal_id,
          action_id,
          project_id,
          week_start,
          title,
          description
        )

        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9
        )

        ON CONFLICT (
          week_plan_id,
          action_id,
          project_id,
          title
        )

        DO UPDATE SET
          updated_at = NOW()

        RETURNING id
        `,
        [
          weekPlanId,
          hierarchy.department_id,
          payload.memberId,
          hierarchy.goal_id,
          hierarchy.action_id,
          projectId,
          currentWeekStart,
          automaticWeekGoalTitle,
          'Automatically created from the project task assignment screen.',
        ],
      );

    const weekGoalId =
      weekGoalResult.rows[0].id;

    // -------------------------------------------------------
    // Create actual daily task
    // -------------------------------------------------------

    const taskResult =
      await client.query<InsertedTaskRow>(
        `
        INSERT INTO tasks (
          week_goal_id,
          action_id,
          project_id,
          assigned_member_id,
          week_start,
          title,
          description,
          task_date,
          status
        )

        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          NULLIF($7, ''),
          $8,
          'NOT_STARTED'
        )

        RETURNING
          id,
          task_date::text AS "taskDate",
          title,
          description
        `,
        [
          weekGoalId,
          hierarchy.action_id,
          projectId,
          payload.memberId,
          currentWeekStart,
          title,
          description,
          payload.taskDate,
        ],
      );

    const insertedTask =
      taskResult.rows[0];

    await client.query('COMMIT');
    transactionOpen = false;

    // -------------------------------------------------------
    // Refresh affected pages
    // -------------------------------------------------------

    revalidatePath(
      `/projects/${projectId}`,
    );

    revalidatePath(
      `/members/${payload.memberId}`,
    );

    revalidatePath(
      `/departments/${hierarchy.department_id}`,
    );

    revalidatePath('/projects');
    revalidatePath('/workload');
    revalidatePath('/dashboard');

    return Response.json(
      {
        task: {
          id:
            insertedTask.id,

          weekGoalId,

          weekGoalTitle:
            automaticWeekGoalTitle,

          actionId:
            hierarchy.action_id,

          actionTitle:
            hierarchy.action_title,

          projectId,

          projectName:
            hierarchy.project_name,

          assignedMemberId:
            payload.memberId,

          assignedMemberName:
            hierarchy.member_name,

          taskDate:
            insertedTask.taskDate,

          title:
            insertedTask.title,

          description:
            insertedTask.description
              ?? undefined,

          status:
            'Not Started',
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (transactionOpen) {
      await client.query('ROLLBACK');
    }

    if (
      typeof error === 'object'
      && error
      && 'code' in error
      && error.code === '23514'
    ) {
      return Response.json(
        {
          error:
            'The task does not match an active project/member planning assignment.',
        },
        { status: 400 },
      );
    }

    console.error(
      'Could not create project task:',
      error,
    );

    return Response.json(
      {
        error:
          'Could not create the project task.',
      },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}