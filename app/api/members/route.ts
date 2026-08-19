import { revalidatePath } from 'next/cache';

import { db } from '@/lib/db';
import {
  isUuid,
  textValue,
} from '@/lib/planner-validation';

interface MemberPayload {
  name?: unknown;
  email?: unknown;
  role?: unknown;
  team?: unknown;
  departmentIds?: unknown;
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

export async function POST(
  request: Request,
) {
  let payload: MemberPayload;

  try {
    payload =
      await request.json() as MemberPayload;
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

  const name =
    textValue(
      payload.name,
      200,
    );

  const email =
    textValue(
      payload.email,
      255,
    );

  const role =
    textValue(
      payload.role,
      200,
    );

  const team =
    textValue(
      payload.team,
      200,
    );

  /*
   * Existing MembersClient sends departmentIds.
   *
   * We require ONE current department.
   */
  const rawDepartmentIds =
    Array.isArray(
      payload.departmentIds,
    )
      ? payload.departmentIds
      : [];

  const departmentId =
    rawDepartmentIds[0];

  if (
    !name ||
    email === null ||
    role === null ||
    team === null ||
    !validEmail(email) ||
    !isUuid(departmentId)
  ) {
    return Response.json(
      {
        error:
          'Name, valid email and current department are required.',
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

    if (!department.rows[0]) {
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

    const result =
      await client.query<{
        id: string;
      }>(
        `
        INSERT INTO members (
          name,
          email,
          role_title,
          team,
          current_department_id
        )
        VALUES (
          $1,
          NULLIF($2, ''),
          NULLIF($3, ''),
          NULLIF($4, ''),
          $5
        )
        RETURNING id
        `,
        [
          name,
          email,
          role,
          team,
          departmentId,
        ],
      );

    const memberId =
      result.rows[0].id;

    /*
     * Also keep the membership relationship because
     * planning/workflow tables depend on it.
     *
     * We never remove old historical relationships.
     */
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
        memberId,
      ],
    );

    await client.query(
      'COMMIT',
    );

    revalidatePath(
      '/members',
    );

    revalidatePath(
      '/departments',
    );

    revalidatePath(
      `/departments/${departmentId}`,
    );

    revalidatePath(
      '/dashboard',
    );

    return Response.json(
      {
        member: {
          id: memberId,
        },
      },
      {
        status: 201,
      },
    );
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
      'Could not create member:',
      error,
    );

    return Response.json(
      {
        error:
          'Could not create the member.',
      },
      {
        status: 500,
      },
    );
  } finally {
    client.release();
  }
}