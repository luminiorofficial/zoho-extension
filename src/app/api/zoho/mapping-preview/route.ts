import type { QueryResultRow } from 'pg';

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
  department_name: string | null;
  team: string | null;
}

interface LocalProject extends QueryResultRow {
  id: string;
  code: string | null;
  name: string;
  master_job_no: string | null;
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

function zohoUserId(
  user: ZohoUser,
): string {
  return String(
    user.zpuid ??
      user.id ??
      user.zuid ??
      '',
  ).trim();
}

function zohoUserName(
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

/*
 * Levenshtein distance.
 *
 * Used ONLY to suggest possible matches.
 * It does NOT modify the database.
 */
function distance(
  a: string,
  b: string,
): number {
  const first =
    normalize(a);

  const second =
    normalize(b);

  const matrix:
    number[][] = [];

  for (
    let i = 0;
    i <= second.length;
    i += 1
  ) {
    matrix[i] = [i];
  }

  for (
    let j = 0;
    j <= first.length;
    j += 1
  ) {
    matrix[0][j] = j;
  }

  for (
    let i = 1;
    i <= second.length;
    i += 1
  ) {
    for (
      let j = 1;
      j <= first.length;
      j += 1
    ) {
      if (
        second.charAt(i - 1) ===
        first.charAt(j - 1)
      ) {
        matrix[i][j] =
          matrix[i - 1][j - 1];
      } else {
        matrix[i][j] =
          Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
      }
    }
  }

  return matrix[
    second.length
  ][first.length];
}

function similarity(
  first: string,
  second: string,
): number {
  const a =
    normalize(first);

  const b =
    normalize(second);

  const maxLength =
    Math.max(
      a.length,
      b.length,
    );

  if (maxLength === 0) {
    return 1;
  }

  return (
    1 -
    distance(a, b) /
      maxLength
  );
}

async function fetchPortalUsers(
  accessToken: string,
  portalId: string,
): Promise<ZohoUser[]> {
  const response =
    await zohoProjectsRequest<
      | ZohoUser[]
      | {
          users?: ZohoUser[];
        }
    >(
      accessToken,

      `/restapi/portal/${portalId}/users/?user_type=active`,
    );

  return Array.isArray(response)
    ? response
    : response.users ?? [];
}

async function fetchZohoProjects(
  accessToken: string,
  portalId: string,
): Promise<ZohoProject[]> {
  const response =
    await zohoProjectsRequest<
      | ZohoProject[]
      | {
          projects?:
            ZohoProject[];
        }
    >(
      accessToken,

      `/api/v3/portal/${portalId}/projects?page=1&per_page=100`,
    );

  return Array.isArray(response)
    ? response
    : response.projects ?? [];
}

function userCandidates(
  zohoUser: ZohoUser,
  members: LocalMember[],
) {
  const name =
    zohoUserName(
      zohoUser,
    );

  const email =
    normalize(
      zohoUser.email,
    );

  return members
    .map((member) => {
      const nameScore =
        similarity(
          name,
          member.name,
        );

      let emailScore = 0;

      if (
        email &&
        member.email
      ) {
        emailScore =
          similarity(
            zohoUser.email ?? '',
            member.email,
          );
      }

      const score =
        Math.max(
          nameScore,
          emailScore,
        );

      return {
        localMemberId:
          member.id,

        localName:
          member.name,

        localEmail:
          member.email,

        department:
          member.department_name,

        team:
          member.team,

        nameScore:
          Number(
            nameScore.toFixed(3),
          ),

        emailScore:
          Number(
            emailScore.toFixed(3),
          ),

        score:
          Number(
            score.toFixed(3),
          ),
      };
    })
    .sort(
      (a, b) =>
        b.score -
        a.score,
    )
    .slice(0, 5);
}

function projectCandidates(
  zohoProject: ZohoProject,
  projects: LocalProject[],
) {
  const zohoName =
    normalizeProject(
      zohoProject.name,
    );

  return projects
    .map((project) => {
      const masterJob =
        normalizeProject(
          project.master_job_no,
        );

      const reconstructed =
        normalizeProject(
          `${
            project.code ?? ''
          }/${project.name}`,
        );

      const localName =
        normalizeProject(
          project.name,
        );

      let score =
        Math.max(
          similarity(
            zohoName,
            masterJob,
          ),

          similarity(
            zohoName,
            reconstructed,
          ),

          similarity(
            zohoName,
            localName,
          ),
        );

      if (
        masterJob &&
        zohoName ===
          masterJob
      ) {
        score = 1;
      }

      return {
        localProjectId:
          project.id,

        localCode:
          project.code,

        localName:
          project.name,

        masterJobNo:
          project.master_job_no,

        score:
          Number(
            score.toFixed(3),
          ),
      };
    })
    .sort(
      (a, b) =>
        b.score -
        a.score,
    )
    .slice(0, 5);
}

export async function GET() {
  try {
    // --------------------------------------------
    // CONNECTION
    // --------------------------------------------

    const connection =
      await getZohoConnection();

    if (!connection) {
      return Response.json(
        {
          error:
            'Zoho is not connected.',
        },
        {
          status: 400,
        },
      );
    }

    const token =
      await refreshZohoAccessToken(
        connection.refreshToken,
      );

    if (
      !token.access_token
    ) {
      throw new Error(
        'Unable to get Zoho access token.',
      );
    }

    const accessToken =
      token.access_token;

    const portalId =
      connection.portalId;

    // --------------------------------------------
    // LOCAL DATA
    // --------------------------------------------

    const [
      memberResult,
      projectResult,
    ] =
      await Promise.all([
        db.query<LocalMember>(
          `
          SELECT
            m.id,
            m.name,
            m.email,
            m.zoho_user_id,
            m.team,

            d.name
              AS department_name

          FROM members m

          LEFT JOIN departments d
            ON d.id =
               m.current_department_id

          WHERE
            m.is_active = TRUE

          ORDER BY
            m.name
          `,
        ),

        db.query<LocalProject>(
          `
          SELECT
            id,
            code,
            name,
            master_job_no

          FROM projects

          WHERE
            is_active = TRUE

          ORDER BY
            name
          `,
        ),
      ]);

    const members =
      memberResult.rows;

    const projects =
      projectResult.rows;

    // --------------------------------------------
    // ZOHO DATA
    // --------------------------------------------

    const [
      zohoUsers,
      zohoProjects,
    ] =
      await Promise.all([
        fetchPortalUsers(
          accessToken,
          portalId,
        ),

        fetchZohoProjects(
          accessToken,
          portalId,
        ),
      ]);

    // --------------------------------------------
    // USER MAPPING PREVIEW
    // --------------------------------------------

    const users =
      zohoUsers.map(
        (user) => {
          const id =
            zohoUserId(
              user,
            );

          const alreadyMapped =
            members.find(
              (member) =>
                member
                  .zoho_user_id ===
                id,
            );

          return {
            zohoUserId:
              id,

            zohoName:
              zohoUserName(
                user,
              ),

            zohoEmail:
              user.email ??
              null,

            alreadyMapped:
              Boolean(
                alreadyMapped,
              ),

            mappedLocalMember:
              alreadyMapped
                ? {
                    id:
                      alreadyMapped.id,

                    name:
                      alreadyMapped.name,

                    department:
                      alreadyMapped
                        .department_name,

                    team:
                      alreadyMapped
                        .team,
                  }
                : null,

            suggestions:
              alreadyMapped
                ? []
                : userCandidates(
                    user,
                    members,
                  ),
          };
        },
      );

    // --------------------------------------------
    // PROJECT MAPPING PREVIEW
    // --------------------------------------------

    const projectMappings =
      zohoProjects.map(
        (zohoProject) => {
          const exact =
            projects.find(
              (project) =>
                normalizeProject(
                  project.master_job_no,
                ) ===
                normalizeProject(
                  zohoProject.name,
                ),
            );

          return {
            zohoProjectId:
              String(
                zohoProject.id,
              ),

            zohoProjectName:
              zohoProject.name ??
              '',

            exactMatch:
              exact
                ? {
                    localProjectId:
                      exact.id,

                    localName:
                      exact.name,

                    masterJobNo:
                      exact.master_job_no,
                  }
                : null,

            suggestions:
              exact
                ? []
                : projectCandidates(
                    zohoProject,
                    projects,
                  ),
          };
        },
      );

    return Response.json({
      mode:
        'MAPPING_PREVIEW',

      databaseChanged:
        false,

      summary: {
        localMembers:
          members.length,

        zohoUsers:
          zohoUsers.length,

        usersAlreadyMapped:
          users.filter(
            (user) =>
              user.alreadyMapped,
          ).length,

        usersNeedingMapping:
          users.filter(
            (user) =>
              !user.alreadyMapped,
          ).length,

        localProjects:
          projects.length,

        zohoProjects:
          zohoProjects.length,

        exactProjectMatches:
          projectMappings.filter(
            (project) =>
              project.exactMatch,
          ).length,

        projectsNeedingMapping:
          projectMappings.filter(
            (project) =>
              !project.exactMatch,
          ).length,
      },

      usersNeedingMapping:
        users.filter(
          (user) =>
            !user.alreadyMapped,
        ),

      projectsNeedingMapping:
        projectMappings.filter(
          (project) =>
            !project.exactMatch,
        ),
    });
  } catch (error) {
    console.error(
      'Zoho mapping preview failed:',
      error,
    );

    return Response.json(
      {
        databaseChanged:
          false,

        error:
          error instanceof Error
            ? error.message
            : 'Mapping preview failed.',
      },
      {
        status: 500,
      },
    );
  }
}