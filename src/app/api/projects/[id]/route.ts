import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import { isDate, isUuid } from '@/lib/planner-validation';

interface ProjectPatchPayload {
  departmentId?: unknown;
  goalId?: unknown;

  clientName?: unknown;
  name?: unknown;
  jobCode?: unknown;
  description?: unknown;

  ownerId?: unknown;
  memberIds?: unknown;

  startDate?: unknown;
  deadline?: unknown;

  status?: unknown;
  budget?: unknown;

  isActive?: unknown;
}

const statuses = new Set([
  'PLANNED',
  'ACTIVE',
  'INTERNAL_REVIEW',
  'CLIENT_REVIEW',
  'DELIVERED',
  'CLOSURE_PENDING',
  'CLOSED',
]);

function cleanText(value: unknown): string {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/projects/[id]'>,
) {
  const { id } = await context.params;

  if (!isUuid(id)) {
    return Response.json(
      { error: 'Invalid project id.' },
      { status: 400 },
    );
  }

  let payload: ProjectPatchPayload;

  try {
    payload = await request.json() as ProjectPatchPayload;
  } catch {
    return Response.json(
      { error: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  // -------------------------------------------------------
  // BASIC VALIDATION
  // -------------------------------------------------------

  if (
    'departmentId' in payload
    && !isUuid(payload.departmentId)
  ) {
    return Response.json(
      { error: 'Select a valid department.' },
      { status: 400 },
    );
  }

  if (
    'goalId' in payload
    && !isUuid(payload.goalId)
  ) {
    return Response.json(
      { error: 'Select a valid goal.' },
      { status: 400 },
    );
  }

  if (
    'ownerId' in payload
    && !isUuid(payload.ownerId)
  ) {
    return Response.json(
      { error: 'Select a valid project owner.' },
      { status: 400 },
    );
  }

  if (
    'startDate' in payload
    && !isDate(payload.startDate)
  ) {
    return Response.json(
      { error: 'Invalid start date.' },
      { status: 400 },
    );
  }

  if (
    'deadline' in payload
    && !isDate(payload.deadline)
  ) {
    return Response.json(
      { error: 'Invalid deadline.' },
      { status: 400 },
    );
  }

  let requestedMemberIds: string[] | undefined;

  if ('memberIds' in payload) {
    if (
      !Array.isArray(payload.memberIds)
      || payload.memberIds.some(
        (memberId) => !isUuid(memberId),
      )
    ) {
      return Response.json(
        { error: 'Invalid assigned members.' },
        { status: 400 },
      );
    }

    requestedMemberIds = [
      ...new Set(payload.memberIds),
    ];
  }

  // -------------------------------------------------------
  // START TRANSACTION
  // -------------------------------------------------------

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const currentResult = await client.query<{
      department_id: string;
      goal_id: string;
      owner_member_id: string | null;
    }>(
      `
      SELECT
        department_id,
        goal_id,
        owner_member_id
      FROM projects
      WHERE id = $1
      FOR UPDATE
      `,
      [id],
    );

    const current = currentResult.rows[0];

    if (!current) {
      await client.query('ROLLBACK');

      return Response.json(
        { error: 'Project not found.' },
        { status: 404 },
      );
    }

    // -----------------------------------------------------
    // NEXT DEPARTMENT + GOAL
    // -----------------------------------------------------

    const nextDepartmentId = isUuid(
      payload.departmentId,
    )
      ? payload.departmentId
      : current.department_id;

    const nextGoalId = isUuid(payload.goalId)
      ? payload.goalId
      : current.goal_id;

    const departmentOrGoalChanged =
      nextDepartmentId !== current.department_id
      || nextGoalId !== current.goal_id;

    // -----------------------------------------------------
    // VALIDATE DEPARTMENT
    // -----------------------------------------------------

    const departmentResult =
      await client.query(
        `
        SELECT 1
        FROM departments
        WHERE id = $1
          AND is_active = TRUE
        `,
        [nextDepartmentId],
      );

    if (!departmentResult.rows[0]) {
      await client.query('ROLLBACK');

      return Response.json(
        {
          error:
            'The selected department is not active.',
        },
        { status: 400 },
      );
    }

    // -----------------------------------------------------
    // VALIDATE GOAL BELONGS TO DEPARTMENT
    // -----------------------------------------------------

    const goalResult =
      await client.query(
        `
        SELECT 1
        FROM goals
        WHERE id = $1
          AND department_id = $2
          AND is_active = TRUE
        `,
        [
          nextGoalId,
          nextDepartmentId,
        ],
      );

    if (!goalResult.rows[0]) {
      await client.query('ROLLBACK');

      return Response.json(
        {
          error:
            'The selected goal must belong to the selected department.',
        },
        { status: 400 },
      );
    }

    // -----------------------------------------------------
    // IMPORTANT:
    // Do not move a project to another department/goal
    // after weekly planning has started.
    //
    // Existing week_goals use project + goal + department
    // foreign-key hierarchy.
    // -----------------------------------------------------

    if (departmentOrGoalChanged) {
      const existingPlanning =
        await client.query(
          `
          SELECT 1
          FROM week_goals
          WHERE project_id = $1
          LIMIT 1
          `,
          [id],
        );

      if (existingPlanning.rows[0]) {
        await client.query('ROLLBACK');

        return Response.json(
          {
            error:
              'This project already has weekly goals. Move or remove the existing weekly planning before changing its department or key goal.',
          },
          { status: 409 },
        );
      }
    }

    // -----------------------------------------------------
    // OWNER
    // -----------------------------------------------------

    const nextOwnerId = isUuid(payload.ownerId)
      ? payload.ownerId
      : current.owner_member_id;

    // -----------------------------------------------------
    // PROJECT MEMBERS
    //
    // Important:
    // Members are NOT restricted to project department.
    //
    // A project can contain:
    // OPERATION + CGI + AI + EDITING + MANAGEMENT etc.
    // -----------------------------------------------------

    const nextMemberIds =
      requestedMemberIds === undefined
        ? undefined
        : [
            ...new Set(
              nextOwnerId
                ? [
                    nextOwnerId,
                    ...requestedMemberIds,
                  ]
                : requestedMemberIds,
            ),
          ];

    const membersToValidate = [
      ...new Set([
        ...(nextOwnerId
          ? [nextOwnerId]
          : []),

        ...(nextMemberIds ?? []),
      ]),
    ];

    if (membersToValidate.length) {
      const validResult =
        await client.query<{
          count: number;
        }>(
          `
          SELECT
            COUNT(*)::integer AS count
          FROM members
          WHERE id = ANY($1::uuid[])
            AND is_active = TRUE
          `,
          [membersToValidate],
        );

      if (
        validResult.rows[0].count
        !== membersToValidate.length
      ) {
        await client.query('ROLLBACK');

        return Response.json(
          {
            error:
              'Every assigned member must be an active team member.',
          },
          { status: 400 },
        );
      }
    }

    // -----------------------------------------------------
    // PROTECT MEMBERS ALREADY USED IN WEEK GOALS /
    // CLOSURE ITEMS
    // -----------------------------------------------------

    if (nextMemberIds !== undefined) {
      const linkedResult =
        await client.query<{
          member_id: string;
        }>(
          `
          SELECT
            assigned_member_id AS member_id
          FROM week_goals
          WHERE project_id = $1

          UNION

          SELECT
            assigned_member_id AS member_id
          FROM project_closure_items
          WHERE project_id = $1
            AND assigned_member_id IS NOT NULL
          `,
          [id],
        );

      const omittedLinkedMember =
        linkedResult.rows.some(
          (row) =>
            !nextMemberIds.includes(
              row.member_id,
            ),
        );

      if (
        !nextMemberIds.length
        || omittedLinkedMember
      ) {
        await client.query('ROLLBACK');

        return Response.json(
          {
            error:
              'Members linked to weekly goals or closure items cannot be removed.',
          },
          { status: 409 },
        );
      }
    }

    // -----------------------------------------------------
    // BUILD UPDATE QUERY
    // -----------------------------------------------------

    const changes: string[] = [];
    const values: unknown[] = [id];

    const addChange = (
      column: string,
      value: unknown,
    ) => {
      values.push(value);

      changes.push(
        `${column} = $${values.length}`,
      );
    };

    if (departmentOrGoalChanged) {
      addChange(
        'department_id',
        nextDepartmentId,
      );

      addChange(
        'goal_id',
        nextGoalId,
      );
    }

    // -----------------------------------------------------
    // TEXT FIELDS
    // -----------------------------------------------------

    for (const [field, column] of [
      ['clientName', 'client_name'],
      ['name', 'name'],
      ['jobCode', 'code'],
    ] as const) {
      if (field in payload) {
        const value =
          cleanText(payload[field]);

        if (!value) {
          await client.query('ROLLBACK');

          return Response.json(
            {
              error:
                `${field} cannot be empty.`,
            },
            { status: 400 },
          );
        }

        addChange(column, value);
      }
    }

    if ('description' in payload) {
      addChange(
        'description',
        cleanText(
          payload.description,
        ) || null,
      );
    }

    // -----------------------------------------------------
    // OWNER
    // -----------------------------------------------------

    if ('ownerId' in payload) {
      addChange(
        'owner_member_id',
        payload.ownerId,
      );
    }

    // -----------------------------------------------------
    // DATES
    // -----------------------------------------------------

    if ('startDate' in payload) {
      addChange(
        'start_date',
        payload.startDate,
      );
    }

    if ('deadline' in payload) {
      addChange(
        'end_date',
        payload.deadline,
      );
    }

    // -----------------------------------------------------
    // VALIDATE DATE ORDER
    // -----------------------------------------------------

    if (
      'startDate' in payload
      && 'deadline' in payload
      && typeof payload.startDate === 'string'
      && typeof payload.deadline === 'string'
      && payload.deadline < payload.startDate
    ) {
      await client.query('ROLLBACK');

      return Response.json(
        {
          error:
            'Deadline cannot be before start date.',
        },
        { status: 400 },
      );
    }

    // -----------------------------------------------------
    // STATUS
    // -----------------------------------------------------

    if ('status' in payload) {
      const status =
        cleanText(payload.status);

      if (!statuses.has(status)) {
        await client.query('ROLLBACK');

        return Response.json(
          {
            error:
              'Invalid project status.',
          },
          { status: 400 },
        );
      }

      addChange(
        'status',
        status,
      );
    }

    // -----------------------------------------------------
    // BUDGET
    // -----------------------------------------------------

    if ('budget' in payload) {
      const budget =
        typeof payload.budget === 'number'
          ? payload.budget
          : Number(
              cleanText(
                payload.budget,
              ),
            );

      if (
        !Number.isFinite(budget)
        || budget < 0
      ) {
        await client.query('ROLLBACK');

        return Response.json(
          {
            error:
              'Budget must be zero or greater.',
          },
          { status: 400 },
        );
      }

      addChange(
        'budget',
        budget,
      );
    }

    // -----------------------------------------------------
    // ACTIVE / RESTORE
    // -----------------------------------------------------

    if ('isActive' in payload) {
      if (typeof payload.isActive !== 'boolean') {
        await client.query('ROLLBACK');

        return Response.json(
          {
            error:
              'Active status must be true or false.',
          },
          { status: 400 },
        );
      }

      addChange(
        'is_active',
        payload.isActive,
      );
    }

    if (
      !changes.length
      && nextMemberIds === undefined
    ) {
      await client.query('ROLLBACK');

      return Response.json(
        {
          error:
            'No supported project changes were provided.',
        },
        { status: 400 },
      );
    }

    // -----------------------------------------------------
    // UPDATE PROJECT
    // -----------------------------------------------------

    if (changes.length) {
      changes.push(
        'updated_at = NOW()',
      );

      await client.query(
        `
        UPDATE projects
        SET ${changes.join(', ')}
        WHERE id = $1
        `,
        values,
      );
    }

    // -----------------------------------------------------
    // UPDATE PROJECT MEMBERS
    // -----------------------------------------------------

    if (nextMemberIds !== undefined) {
      await client.query(
        `
        DELETE FROM project_members
        WHERE project_id = $1
        `,
        [id],
      );

      if (nextMemberIds.length) {
        await client.query(
          `
          INSERT INTO project_members (
            project_id,
            member_id
          )
          SELECT
            $1,
            UNNEST($2::uuid[])
          ON CONFLICT DO NOTHING
          `,
          [
            id,
            nextMemberIds,
          ],
        );
      }
    }

    await client.query('COMMIT');

    // -----------------------------------------------------
    // REFRESH SCREENS
    // -----------------------------------------------------

    revalidatePath('/projects');
    revalidatePath('/workload');
    revalidatePath(
      `/projects/${id}`,
    );

    revalidatePath(
      `/departments/${current.department_id}`,
    );

    revalidatePath(
      `/departments/${nextDepartmentId}`,
    );

    revalidatePath('/departments');
    revalidatePath('/dashboard');

    return Response.json({
      project: {
        id,
        departmentId:
          nextDepartmentId,
        goalId: nextGoalId,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (
      typeof error === 'object'
      && error
      && 'code' in error
      && error.code === '23514'
    ) {
      return Response.json(
        {
          error:
            'Complete every required job closure item before marking this project Closed.',
        },
        { status: 409 },
      );
    }

    if (
      typeof error === 'object'
      && error
      && 'code' in error
      && error.code === '23505'
    ) {
      return Response.json(
        {
          error:
            'That project name is already in use in the selected department.',
        },
        { status: 409 },
      );
    }

    console.error(
      'Could not update project:',
      error,
    );

    return Response.json(
      {
        error:
          'Could not update the project.',
      },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

// -----------------------------------------------------------
// DELETE
//
// A project is never blindly hard-deleted. It is referenced by many
// tables (key_assignments, week_goals, tasks, project_members,
// project_closure_items, project_keys, and Zoho mappings), and several
// of those are auto-populated the moment a project is created. So in
// practice almost every project has at least one reference and is
// archived (is_active = FALSE) instead of removed -- historical work
// stays intact and readable everywhere it is already joined without an
// is_active filter. A project is only hard-deleted when every one of
// those tables has zero rows for it.
// -----------------------------------------------------------

interface ProjectReferenceCounts {
  key_assignments: string;
  week_goals: string;
  tasks: string;
  project_members: string;
  project_closure_items: string;
  project_keys: string;
  zoho_mappings: string;
}

export async function DELETE(
  _request: Request,
  context: RouteContext<'/api/projects/[id]'>,
) {
  const { id } = await context.params;

  if (!isUuid(id)) {
    return Response.json(
      { error: 'Invalid project id.' },
      { status: 400 },
    );
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const projectResult = await client.query<{
      id: string;
      department_id: string;
      is_active: boolean;
    }>(
      `SELECT id, department_id, is_active
         FROM projects
        WHERE id = $1
        FOR UPDATE`,
      [id],
    );

    const project = projectResult.rows[0];

    if (!project) {
      await client.query('ROLLBACK');

      return Response.json(
        { error: 'Project not found.' },
        { status: 404 },
      );
    }

    const referenceResult = await client.query<ProjectReferenceCounts>(
      `SELECT
         (SELECT COUNT(*) FROM key_assignments WHERE project_id = $1) AS key_assignments,
         (SELECT COUNT(*) FROM week_goals WHERE project_id = $1) AS week_goals,
         (SELECT COUNT(*) FROM tasks WHERE project_id = $1) AS tasks,
         (SELECT COUNT(*) FROM project_members WHERE project_id = $1) AS project_members,
         (SELECT COUNT(*) FROM project_closure_items WHERE project_id = $1) AS project_closure_items,
         (SELECT COUNT(*) FROM project_keys WHERE project_id = $1) AS project_keys,
         (SELECT COUNT(*) FROM zoho_mappings WHERE entity_type = 'PROJECT' AND local_id = $1) AS zoho_mappings`,
      [id],
    );

    const counts = referenceResult.rows[0];
    const referenced = Object.values(counts).some((count) => Number(count) > 0);

    if (!referenced) {
      await client.query('DELETE FROM projects WHERE id = $1', [id]);
      await client.query('COMMIT');

      revalidatePath('/projects');
      revalidatePath('/workload');
      revalidatePath(`/departments/${project.department_id}`);
      revalidatePath('/departments');
      revalidatePath('/dashboard');

      return Response.json({
        project: { id, deleted: true, isActive: false },
        message: 'The project had no work or historical data and was permanently deleted.',
      });
    }

    if (!project.is_active) {
      await client.query('ROLLBACK');

      return Response.json({
        project: { id, deleted: false, isActive: false },
        message: 'This project is already archived. Historical data is preserved.',
      });
    }

    await client.query(
      `UPDATE projects SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
      [id],
    );
    await client.query('COMMIT');

    revalidatePath('/projects');
    revalidatePath(`/projects/${id}`);
    revalidatePath('/workload');
    revalidatePath(`/departments/${project.department_id}`);
    revalidatePath('/departments');
    revalidatePath('/dashboard');
    revalidatePath('/keys');

    return Response.json({
      project: { id, deleted: false, isActive: false },
      message: 'This project has historical or active work data, so it was archived instead of deleted. Historical records are preserved and remain visible on past assignments.',
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Could not delete project:', error);

    return Response.json(
      { error: 'Could not delete the project.' },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}