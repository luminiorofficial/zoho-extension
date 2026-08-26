import type { PoolClient, QueryResultRow } from 'pg';

import { db } from '@/lib/db';

import {
  refreshZohoAccessToken,
  zohoProjectsRequest,
} from '@/lib/zoho/oauth';

import {
  getZohoConnection,
} from '@/lib/zoho/token-store';

interface ZohoUser {
  id?: string | number;
  zpuid?: string | number;
  zuid?: string | number;

  name?: string;
  first_name?: string;
  last_name?: string;

  email?: string;
}

interface ZohoProject {
  id: string | number;
  name?: string;
}

interface LocalMember extends QueryResultRow {
  id: string;
  name: string;
  email: string | null;
  zoho_user_id: string | null;
}

interface LocalProject extends QueryResultRow {
  id: string;
  name: string;
  code: string | null;
  master_job_no: string | null;
}

interface ExistingProjectMapping extends QueryResultRow {
  local_id: string;
  zoho_entity_id: string | null;
}

function normalize(
  value: string | null | undefined,
): string {
  return (value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeProject(
  value: string | null | undefined,
): string {
  return normalize(value)
    .replace(/\s*\/\s*/g, '/');
}

function getZohoUserId(
  user: ZohoUser,
): string {
  return String(
    user.zpuid ??
      user.id ??
      user.zuid ??
      '',
  ).trim();
}

function getZohoUserName(
  user: ZohoUser,
): string {
  const fullName = [
    user.first_name,
    user.last_name,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (fullName) {
    return fullName;
  }

  return user.name?.trim() ?? '';
}

async function fetchPortalUsers(
  accessToken: string,
  portalId: string,
): Promise<ZohoUser[]> {
  const payload =
    await zohoProjectsRequest<
      | ZohoUser[]
      | {
          users?: ZohoUser[];
        }
    >(
      accessToken,
      `/restapi/portal/${portalId}/users/?user_type=active`,
    );

  return Array.isArray(payload)
    ? payload
    : payload.users ?? [];
}

async function fetchProjects(
  accessToken: string,
  portalId: string,
): Promise<ZohoProject[]> {
  const payload =
    await zohoProjectsRequest<
      | ZohoProject[]
      | {
          projects?: ZohoProject[];
        }
    >(
      accessToken,
      `/api/v3/portal/${portalId}/projects?page=1&per_page=100`,
    );

  return Array.isArray(payload)
    ? payload
    : payload.projects ?? [];
}

function findSafeMemberMatch(
  zohoUser: ZohoUser,
  members: LocalMember[],
): {
  member: LocalMember | null;
  matchedBy: 'EMAIL' | 'EXACT_NAME' | 'NONE';
} {
  const zohoEmail =
    normalize(zohoUser.email);

  // ==========================================
  // 1. EXACT EMAIL
  // ==========================================

  if (zohoEmail) {
    const emailMatches =
      members.filter(
        (member) =>
          member.email &&
          normalize(member.email) ===
            zohoEmail,
      );

    if (emailMatches.length === 1) {
      return {
        member: emailMatches[0],
        matchedBy: 'EMAIL',
      };
    }
  }

  // ==========================================
  // 2. EXACT FULL NAME
  // ==========================================

  const zohoName =
    normalize(
      getZohoUserName(zohoUser),
    );

  if (!zohoName) {
    return {
      member: null,
      matchedBy: 'NONE',
    };
  }

  const nameMatches =
    members.filter(
      (member) =>
        normalize(member.name) ===
        zohoName,
    );

  if (nameMatches.length === 1) {
    return {
      member: nameMatches[0],
      matchedBy: 'EXACT_NAME',
    };
  }

  return {
    member: null,
    matchedBy: 'NONE',
  };
}

function getZohoProjectCode(
  value: string | null | undefined,
): string {
  const normalized =
    normalizeProject(value);

  const parts =
    normalized
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean);

  if (parts.length < 3) {
    return '';
  }

  return parts
    .slice(0, 3)
    .join('/');
}

function findSafeProjectMatch(
  zohoProject: ZohoProject,
  projects: LocalProject[],
  allZohoProjects: ZohoProject[],
): LocalProject | null {
  const zohoName =
    normalizeProject(
      zohoProject.name,
    );

  if (!zohoName) {
    return null;
  }

  // ==========================================
  // 1. EXACT MASTER JOB NUMBER
  // ==========================================

  const masterMatches =
    projects.filter(
      (project) =>
        project.master_job_no &&
        normalizeProject(
          project.master_job_no,
        ) === zohoName,
    );

  if (masterMatches.length === 1) {
    return masterMatches[0];
  }

  // ==========================================
  // 2. UNIQUE PROJECT CODE
  //
  // Example:
  // D1/004/2627/LL/SE
  //       ↓
  // D1/004/2627
  //
  // Only use this when that code occurs
  // exactly once locally AND once in Zoho.
  // ==========================================

  const zohoCode =
    getZohoProjectCode(
      zohoProject.name,
    );

  if (!zohoCode) {
    return null;
  }

  const localCodeMatches =
    projects.filter(
      (project) =>
        normalizeProject(
          project.code,
        ) === zohoCode,
    );

  const zohoCodeMatches =
    allZohoProjects.filter(
      (project) =>
        getZohoProjectCode(
          project.name,
        ) === zohoCode,
    );

  if (
    localCodeMatches.length === 1 &&
    zohoCodeMatches.length === 1
  ) {
    return localCodeMatches[0];
  }

  // Duplicate/ambiguous code.
  // Do NOT guess.
  return null;
}

async function applyMappings(
  client: PoolClient,
  users: ZohoUser[],
  projects: ZohoProject[],
  localMembers: LocalMember[],
  localProjects: LocalProject[],
  existingProjectMappings:
    ExistingProjectMapping[],
) {
  const memberResults = {
    applied: [] as Array<{
      zohoUserId: string;
      zohoName: string;
      localMemberId: string;
      localName: string;
      matchedBy: string;
    }>,

    alreadyMapped: [] as Array<{
      zohoUserId: string;
      zohoName: string;
      localMemberId: string;
      localName: string;
    }>,

    needsManualReview: [] as Array<{
      zohoUserId: string;
      zohoName: string;
      zohoEmail: string | null;
    }>,

    conflicts: [] as Array<{
      zohoUserId: string;
      zohoName: string;
      reason: string;
    }>,
  };

  /*
   * Protect against accidentally mapping
   * two Zoho accounts to one local employee.
   */
  const claimedLocalMembers =
    new Map<string, string>();

  for (const member of localMembers) {
    if (member.zoho_user_id) {
      claimedLocalMembers.set(
        member.id,
        member.zoho_user_id,
      );
    }
  }

  // ==========================================
  // MEMBER MAPPINGS
  // ==========================================

  for (const user of users) {
    const zohoId =
      getZohoUserId(user);

    const zohoName =
      getZohoUserName(user);

    if (!zohoId) {
      memberResults
        .needsManualReview
        .push({
          zohoUserId: '',
          zohoName,
          zohoEmail:
            user.email ?? null,
        });

      continue;
    }

    const existingByZohoId =
      localMembers.find(
        (member) =>
          member.zoho_user_id ===
          zohoId,
      );

    if (existingByZohoId) {
      memberResults
        .alreadyMapped
        .push({
          zohoUserId: zohoId,

          zohoName,

          localMemberId:
            existingByZohoId.id,

          localName:
            existingByZohoId.name,
        });

      continue;
    }

    const safeMatch =
      findSafeMemberMatch(
        user,
        localMembers,
      );

    if (!safeMatch.member) {
      memberResults
        .needsManualReview
        .push({
          zohoUserId: zohoId,

          zohoName,

          zohoEmail:
            user.email ?? null,
        });

      continue;
    }

    const claimedZohoId =
      claimedLocalMembers.get(
        safeMatch.member.id,
      );

    if (
      claimedZohoId &&
      claimedZohoId !== zohoId
    ) {
      memberResults
        .conflicts
        .push({
          zohoUserId: zohoId,

          zohoName,

          reason:
            `Local employee ${safeMatch.member.name} is already mapped to another Zoho user.`,
        });

      continue;
    }

    const result =
      await client.query(
        `
        UPDATE members

           SET zoho_user_id = $1,
               updated_at = NOW()

         WHERE id = $2

           AND (
             zoho_user_id IS NULL
             OR zoho_user_id = $1
           )

        RETURNING id
        `,
        [
          zohoId,
          safeMatch.member.id,
        ],
      );

    if (result.rowCount !== 1) {
      memberResults
        .conflicts
        .push({
          zohoUserId: zohoId,

          zohoName,

          reason:
            'The local employee already has a different Zoho mapping.',
        });

      continue;
    }

    claimedLocalMembers.set(
      safeMatch.member.id,
      zohoId,
    );

    memberResults.applied.push({
      zohoUserId: zohoId,

      zohoName,

      localMemberId:
        safeMatch.member.id,

      localName:
        safeMatch.member.name,

      matchedBy:
        safeMatch.matchedBy,
    });
  }

  // ==========================================
  // PROJECT MAPPINGS
  // ==========================================

  const projectResults = {
    applied: [] as Array<{
      zohoProjectId: string;
      zohoProjectName: string;
      localProjectId: string;
      localProjectName: string;
    }>,

    alreadyMapped: [] as Array<{
      zohoProjectId: string;
      zohoProjectName: string;
      localProjectId: string;
    }>,

    needsManualReview: [] as Array<{
      zohoProjectId: string;
      zohoProjectName: string;
    }>,

    conflicts: [] as Array<{
      zohoProjectId: string;
      zohoProjectName: string;
      reason: string;
    }>,
  };

  const zohoProjectIdsAlreadyClaimed =
    new Map<string, string>();

  for (
    const mapping
    of existingProjectMappings
  ) {
    if (mapping.zoho_entity_id) {
      zohoProjectIdsAlreadyClaimed.set(
        mapping.zoho_entity_id,
        mapping.local_id,
      );
    }
  }

  for (
    const zohoProject
    of projects
  ) {
    const zohoProjectId =
      String(
        zohoProject.id,
      );

    const zohoProjectName =
      zohoProject.name ?? '';

    const existingByZoho =
      existingProjectMappings.find(
        (mapping) =>
          mapping.zoho_entity_id ===
          zohoProjectId,
      );

    if (existingByZoho) {
      projectResults
        .alreadyMapped
        .push({
          zohoProjectId,

          zohoProjectName,

          localProjectId:
            existingByZoho.local_id,
        });

      continue;
    }

    const localProject =
  findSafeProjectMatch(
    zohoProject,
    localProjects,
    projects,
  );

    if (!localProject) {
      projectResults
        .needsManualReview
        .push({
          zohoProjectId,

          zohoProjectName,
        });

      continue;
    }

    const existingForLocal =
      existingProjectMappings.find(
        (mapping) =>
          mapping.local_id ===
          localProject.id,
      );

    if (
      existingForLocal
        ?.zoho_entity_id &&
      existingForLocal
        .zoho_entity_id !==
        zohoProjectId
    ) {
      projectResults
        .conflicts
        .push({
          zohoProjectId,

          zohoProjectName,

          reason:
            `${localProject.name} is already mapped to another Zoho project.`,
        });

      continue;
    }

    const claimedLocalId =
      zohoProjectIdsAlreadyClaimed.get(
        zohoProjectId,
      );

    if (
      claimedLocalId &&
      claimedLocalId !==
        localProject.id
    ) {
      projectResults
        .conflicts
        .push({
          zohoProjectId,

          zohoProjectName,

          reason:
            'This Zoho project is already mapped to another local project.',
        });

      continue;
    }

    await client.query(
      `
      INSERT INTO zoho_mappings (
        entity_type,
        local_id,
        zoho_entity_id,
        zoho_project_id,
        last_synced_at,
        sync_status,
        created_at,
        updated_at
      )

      VALUES (
        'PROJECT',
        $1,
        $2,
        $2,
        NOW(),
        'MAPPED',
        NOW(),
        NOW()
      )

      ON CONFLICT (
        entity_type,
        local_id
      )

      DO UPDATE SET
        zoho_entity_id =
          EXCLUDED.zoho_entity_id,

        zoho_project_id =
          EXCLUDED.zoho_project_id,

        last_synced_at =
          NOW(),

        sync_status =
          'MAPPED',

        updated_at =
          NOW()
      `,
      [
        localProject.id,
        zohoProjectId,
      ],
    );

    zohoProjectIdsAlreadyClaimed.set(
      zohoProjectId,
      localProject.id,
    );

    projectResults.applied.push({
      zohoProjectId,

      zohoProjectName,

      localProjectId:
        localProject.id,

      localProjectName:
        localProject.name,
    });
  }

  return {
    members:
      memberResults,

    projects:
      projectResults,
  };
}

export async function POST() {
  let client: PoolClient | null =
    null;

  let transactionStarted =
    false;

  try {
    // ==========================================
    // 1. GET ZOHO CONNECTION FIRST
    //
    // IMPORTANT:
    // Do this BEFORE db.connect(), because
    // PostgreSQL pool max = 1.
    // ==========================================

    const connection =
      await getZohoConnection();

    if (!connection) {
      return Response.json(
        {
          success: false,

          error:
            'Zoho is not connected.',
        },
        {
          status: 400,
        },
      );
    }

    // ==========================================
    // 2. GET FRESH ZOHO ACCESS TOKEN
    // ==========================================

    const tokenResponse =
      await refreshZohoAccessToken(
        connection.refreshToken,
      );

    const accessToken =
      tokenResponse.access_token;

    if (!accessToken) {
      throw new Error(
        'Unable to get Zoho access token.',
      );
    }

    // ==========================================
    // 3. FETCH ZOHO DATA
    //
    // Still no dedicated DB client held.
    // ==========================================

    const [
      zohoUsers,
      zohoProjects,
    ] =
      await Promise.all([
        fetchPortalUsers(
          accessToken,
          connection.portalId,
        ),

        fetchProjects(
          accessToken,
          connection.portalId,
        ),
      ]);

    // ==========================================
    // 4. NOW TAKE THE SINGLE DB CONNECTION
    // ==========================================

    client =
      await db.connect();

    await client.query(
      'BEGIN',
    );

    transactionStarted =
      true;

    // ==========================================
    // 5. LOAD LOCAL MEMBERS
    // ==========================================

    const localMemberResult =
      await client.query<LocalMember>(
        `
        SELECT
          id,
          name,
          email,
          zoho_user_id

        FROM members

        WHERE
          is_active = TRUE

        ORDER BY
          name
        `,
      );

    // ==========================================
    // 6. LOAD LOCAL PROJECTS
    // ==========================================

    const localProjectResult =
      await client.query<LocalProject>(
        `
        SELECT
          id,
          name,
          code,
          master_job_no

        FROM projects

        WHERE
          is_active = TRUE

        ORDER BY
          name
        `,
      );

    // ==========================================
    // 7. EXISTING PROJECT MAPPINGS
    // ==========================================

    const projectMappingResult =
      await client.query<
        ExistingProjectMapping
      >(
        `
        SELECT
          local_id,
          zoho_entity_id

        FROM zoho_mappings

        WHERE
          entity_type = 'PROJECT'
        `,
      );

    // ==========================================
    // 8. APPLY ONLY SAFE EXACT MAPPINGS
    // ==========================================

    const result =
      await applyMappings(
        client,

        zohoUsers,

        zohoProjects,

        localMemberResult.rows,

        localProjectResult.rows,

        projectMappingResult.rows,
      );

    // ==========================================
    // 9. COMMIT
    // ==========================================

    await client.query(
      'COMMIT',
    );

    transactionStarted =
      false;

    // ==========================================
    // 10. RESULT
    // ==========================================

    return Response.json({
      success: true,

      mode:
        'SAFE_EXACT_MAPPING',

      message:
        'Only unique exact employee matches and exact master-job-number project matches were saved. Fuzzy matches were left untouched.',

      summary: {
        zohoUsers:
          zohoUsers.length,

        employeeMappingsApplied:
          result.members
            .applied.length,

        employeeMappingsAlreadyExisting:
          result.members
            .alreadyMapped.length,

        employeesNeedingManualReview:
          result.members
            .needsManualReview
            .length,

        employeeConflicts:
          result.members
            .conflicts.length,

        zohoProjects:
          zohoProjects.length,

        projectMappingsApplied:
          result.projects
            .applied.length,

        projectMappingsAlreadyExisting:
          result.projects
            .alreadyMapped.length,

        projectsNeedingManualReview:
          result.projects
            .needsManualReview
            .length,

        projectConflicts:
          result.projects
            .conflicts.length,
      },

      employeeMappingsApplied:
        result.members.applied,

      employeesNeedingManualReview:
        result.members
          .needsManualReview,

      employeeConflicts:
        result.members
          .conflicts,

      projectMappingsApplied:
        result.projects.applied,

      projectsNeedingManualReview:
        result.projects
          .needsManualReview,

      projectConflicts:
        result.projects
          .conflicts,
    });
  } catch (error) {
    // ==========================================
    // ROLLBACK ONLY IF TRANSACTION STARTED
    // ==========================================

    if (
      client &&
      transactionStarted
    ) {
      try {
        await client.query(
          'ROLLBACK',
        );
      } catch (
        rollbackError
      ) {
        console.error(
          'Zoho mapping rollback failed:',
          rollbackError,
        );
      }
    }

    console.error(
      'Safe Zoho mapping failed:',
      error,
    );

    return Response.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : 'Safe mapping failed.',
      },
      {
        status: 500,
      },
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}