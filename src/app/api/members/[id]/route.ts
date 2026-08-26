import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import {
  isUuid,
  textValue,
} from '@/lib/planner-validation';

interface MemberPatchPayload {
  name?: unknown;
  email?: unknown;
  role?: unknown;
  team?: unknown;
  departmentIds?: unknown;
  isActive?: unknown;
}

function validEmail(
  email: string,
): boolean {
  return (
    !email ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email,
    )
  );
}

function refreshMember(
  id: string,
  departmentIds: string[],
) {
  revalidatePath('/members');

  revalidatePath(
    `/members/${id}`,
  );

  revalidatePath(
    '/departments',
  );

  revalidatePath(
    '/projects',
  );

  revalidatePath(
    '/workload',
  );

  revalidatePath(
    '/dashboard',
  );

  for (
    const departmentId
    of departmentIds
  ) {
    revalidatePath(
      `/departments/${departmentId}`,
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext<
    '/api/members/[id]'
  >,
) {
  const { id } =
    await context.params;

  if (!isUuid(id)) {
    return Response.json(
      {
        error:
          'Invalid member id.',
      },
      {
        status: 400,
      },
    );
  }

  let payload: MemberPatchPayload;

  try {
    payload =
      await request.json() as MemberPatchPayload;
  } catch {
    return Response.json(
      {
        error:
          'Invalid JSON body.',
      },
      {
        status: 400,
      },
    );
  }

  const changes: string[] = [];
  const values: unknown[] = [id];

  const add = (
    column: string,
    value: unknown,
  ) => {
    values.push(value);

    changes.push(
      `${column} = $${values.length}`,
    );
  };

  if ('name' in payload) {
    const name =
      textValue(
        payload.name,
        200,
      );

    if (!name) {
      return Response.json(
        {
          error:
            'Member name is required.',
        },
        {
          status: 400,
        },
      );
    }

    add(
      'name',
      name,
    );
  }

  if ('email' in payload) {
    const email =
      textValue(
        payload.email,
        255,
      );

    if (
      email === null ||
      !validEmail(email)
    ) {
      return Response.json(
        {
          error:
            'Enter a valid email address.',
        },
        {
          status: 400,
        },
      );
    }

    add(
      'email',
      email || null,
    );
  }

  if ('role' in payload) {
    const role =
      textValue(
        payload.role,
        200,
      );

    if (role === null) {
      return Response.json(
        {
          error:
            'Designation is too long.',
        },
        {
          status: 400,
        },
      );
    }

    add(
      'role_title',
      role || null,
    );
  }

  if ('team' in payload) {
    const team =
      textValue(
        payload.team,
        200,
      );

    if (team === null) {
      return Response.json(
        {
          error:
            'Team is too long.',
        },
        {
          status: 400,
        },
      );
    }

    add(
      'team',
      team || null,
    );
  }

  if ('isActive' in payload) {
    if (
      typeof payload.isActive !==
      'boolean'
    ) {
      return Response.json(
        {
          error:
            'Active status must be true or false.',
        },
        {
          status: 400,
        },
      );
    }

    add(
      'is_active',
      payload.isActive,
    );
  }

  let departmentId:
    | string
    | undefined;

  if (
    'departmentIds' in payload
  ) {
    if (
      !Array.isArray(
        payload.departmentIds,
      ) ||
      !payload.departmentIds.length ||
      !isUuid(
        payload.departmentIds[0],
      )
    ) {
      return Response.json(
        {
          error:
            'Select a current department.',
        },
        {
          status: 400,
        },
      );
    }

    departmentId =
      payload.departmentIds[0];

    add(
      'current_department_id',
      departmentId,
    );
  }

  if (!changes.length) {
    return Response.json(
      {
        error:
          'No supported member changes were provided.',
      },
      {
        status: 400,
      },
    );
  }

  const client =
    await db.connect();

  try {
    await client.query(
      'BEGIN',
    );

    const current =
      await client.query<{
        id: string;
        current_department_id:
          | string
          | null;
      }>(
        `
        SELECT
          id,
          current_department_id
        FROM members
        WHERE id = $1
        FOR UPDATE
        `,
        [id],
      );

    if (!current.rows[0]) {
      await client.query(
        'ROLLBACK',
      );

      return Response.json(
        {
          error:
            'Member not found.',
        },
        {
          status: 404,
        },
      );
    }

    const oldDepartmentId =
      current.rows[0]
        .current_department_id;

    if (departmentId) {
      const department =
        await client.query<{
          id: string;
        }>(
          `
          SELECT id
            FROM departments
           WHERE id = $1
             AND is_active = TRUE
          `,
          [departmentId],
        );

      if (
        !department.rows[0]
      ) {
        await client.query(
          'ROLLBACK',
        );

        return Response.json(
          {
            error:
              'Selected department must be active.',
          },
          {
            status: 400,
          },
        );
      }
    }

    await client.query(
      `
      UPDATE members
      SET ${changes.join(', ')},
          updated_at = NOW()
      WHERE id = $1
      `,
      values,
    );

    /*
     * Preserve historical department memberships.
     *
     * Only INSERT the new/current relationship.
     *
     * Never DELETE old department_members here.
     */
    if (departmentId) {
      await client.query(
        `
        INSERT INTO department_members (
          department_id,
          member_id
        )
        VALUES ($1, $2)
        ON CONFLICT (
          department_id,
          member_id
        )
        DO NOTHING
        `,
        [
          departmentId,
          id,
        ],
      );
    }

    await client.query(
      'COMMIT',
    );

    const refreshDepartments =
      [
        oldDepartmentId,
        departmentId,
      ].filter(
        (
          department,
        ): department is string =>
          Boolean(department),
      );

    refreshMember(
      id,
      [
        ...new Set(
          refreshDepartments,
        ),
      ],
    );

    return Response.json({
      member: {
        id,
      },
    });
  } catch (error) {
    await client.query(
      'ROLLBACK',
    );

    if (
      typeof error ===
        'object' &&
      error &&
      'code' in error &&
      error.code === '23505'
    ) {
      return Response.json(
        {
          error:
            'A member with this email already exists.',
        },
        {
          status: 409,
        },
      );
    }

    console.error(
      'Could not update member:',
      error,
    );

    return Response.json(
      {
        error:
          'Could not update the member.',
      },
      {
        status: 500,
      },
    );
  } finally {
    client.release();
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<
    '/api/members/[id]'
  >,
) {
  const { id } =
    await context.params;

  if (!isUuid(id)) {
    return Response.json(
      {
        error:
          'Invalid member id.',
      },
      {
        status: 400,
      },
    );
  }

  try {
    const result =
      await db.query<{
        department_ids: string[];
      }>(
        `
        WITH updated AS (
          UPDATE members
             SET is_active = FALSE
           WHERE id = $1
           RETURNING
             id,
             current_department_id
        )
        SELECT
          COALESCE(
            ARRAY_AGG(
              DISTINCT department_id
            ) FILTER (
              WHERE department_id IS NOT NULL
            ),
            '{}'
          ) AS department_ids
        FROM (
          SELECT
            u.id,
            u.current_department_id
              AS department_id
          FROM updated u

          UNION

          SELECT
            dm.member_id AS id,
            dm.department_id
          FROM department_members dm
          JOIN updated u
            ON u.id = dm.member_id
        ) departments
        GROUP BY id
        `,
        [id],
      );

    if (!result.rows[0]) {
      return Response.json(
        {
          error:
            'Member not found.',
        },
        {
          status: 404,
        },
      );
    }

    refreshMember(
      id,
      result.rows[0]
        .department_ids,
    );

    return Response.json({
      member: {
        id,
        isActive: false,
      },
    });
  } catch (error) {
    console.error(
      'Could not deactivate member:',
      error,
    );

    return Response.json(
      {
        error:
          'Could not deactivate the member.',
      },
      {
        status: 500,
      },
    );
  }
}