import type { QueryResultRow } from 'pg';

import { db } from '@/lib/db';

import {
  refreshZohoAccessToken,
  zohoProjectsRequest,
} from '@/lib/zoho/oauth';

import {
  getZohoConnection,
} from '@/lib/zoho/token-store';

// ======================================================
// TYPES
// ======================================================

interface PageInfo {
  page?: number;
  per_page?: number;
  has_next_page?: boolean;
}

interface ZohoProject {
  id: string | number;
  name?: string;

  status?:
    | string
    | {
        id?: string | number;
        name?: string;
      };
}

interface ZohoUser {
  id?: string | number;
  zpuid?: string | number;
  zuid?: string | number;

  name?: string;
  full_name?: string;

  first_name?: string;
  last_name?: string;

  email?: string;

  active?: boolean;

  work_values?: string;
}

interface ZohoTaskStatus {
  id?: string | number;
  name?: string;

  is_closed_type?: boolean;
}

interface ZohoOwnersAndWork {
  work_type?: string;

  total_work?: string;

  unit?: string;

  owners?: ZohoUser[];
}

interface ZohoTask {
  id: string | number;

  prefix?: string;

  name?: string;

  description?: string;

  status?: ZohoTaskStatus;

  priority?: string;

  /*
   * This is the actual structure returned
   * by this Zoho Projects account.
   */
  owners_and_work?: ZohoOwnersAndWork;

  /*
   * Keep these as fallbacks in case Zoho
   * returns another task format later.
   */
  assignee?:
    | ZohoUser
    | ZohoUser[];

  assignees?: ZohoUser[];

  owner?: ZohoUser;

  owners?: ZohoUser[];

  start_date?: string;

  end_date?: string;

  due_date?: string;

  completion_percentage?: number;

  is_completed?: boolean;

  created_time?: string;

  last_modified_time?: string;

  completed_time?: string;

  task_category?: string;

  tasklist?: {
    id?: string | number;
    name?: string;
  };

  project?: {
    id?: string | number;
    name?: string;
  };
}

interface LocalProject extends QueryResultRow {
  id: string;

  code: string | null;

  name: string;

  master_job_no: string | null;
}

interface LocalMember extends QueryResultRow {
  id: string;

  name: string;

  email: string | null;

  zoho_user_id: string | null;

  department_name: string | null;

  team: string | null;
}

interface MatchResult {
  member: LocalMember | null;

  matchedBy:
    | 'ZOHO_ID'
    | 'EMAIL'
    | 'NAME'
    | 'NONE';

  ambiguous: boolean;
}

interface ZohoObjectResponse {
  [key: string]: unknown;

  page_info?: PageInfo;
}

interface UserPreview {
  zohoUserId: string | null;

  zohoName: string;

  zohoEmail: string | null;

  matched: boolean;

  ambiguous: boolean;

  matchedBy:
    | 'ZOHO_ID'
    | 'EMAIL'
    | 'NAME'
    | 'NONE';

  localMemberId: string | null;

  localName: string | null;

  department: string | null;

  team: string | null;

  workValue?: string | null;
}

interface TaskPreview {
  zohoTaskId: string;

  prefix: string | null;

  name: string;

  status: string;

  isClosed: boolean;

  completionPercentage: number;

  priority: string | null;

  category: string | null;

  taskList: string | null;

  startDate: string | null;

  endDate: string | null;

  createdTime: string | null;

  lastModifiedTime: string | null;

  completedTime: string | null;

  assigneeCount: number;

  hasUnmatchedAssignee: boolean;

  assignees: UserPreview[];
}

interface MemberTaskItem {
  zohoTaskId: string;

  prefix: string | null;

  name: string;

  status: string;

  isClosed: boolean;

  completionPercentage: number;

  startDate: string | null;

  endDate: string | null;
}

interface MemberTaskSummary {
  zohoUserId: string | null;

  localMemberId: string | null;

  name: string;

  zohoName: string;

  email: string | null;

  department: string | null;

  team: string | null;

  matched: boolean;

  matchedBy:
    | 'ZOHO_ID'
    | 'EMAIL'
    | 'NAME'
    | 'NONE';

  isZohoProjectMember: boolean;

  assignedTaskCount: number;

  closedTaskCount: number;

  openTaskCount: number;

  tasks: MemberTaskItem[];
}

// ======================================================
// NORMALIZATION
// ======================================================

function normalize(
  value: string | null | undefined,
): string {
  return (value ?? '')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
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
  if (user.full_name?.trim()) {
    return user.full_name.trim();
  }

  /*
   * In your Zoho task response "name"
   * may only contain the first name.
   *
   * Therefore first_name + last_name is
   * preferable when both are present.
   */
  const completeName = [
    user.first_name,
    user.last_name,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (completeName) {
    return completeName;
  }

  if (user.name?.trim()) {
    return user.name.trim();
  }

  return '';
}

// ======================================================
// PAGINATION
// ======================================================

async function fetchAllV3<T>(
  accessToken: string,
  path: string,
  responseKey: string,
): Promise<T[]> {
  const allRecords: T[] = [];

  let page = 1;

  while (true) {
    const separator =
      path.includes('?')
        ? '&'
        : '?';

    const payload =
      await zohoProjectsRequest<
        T[] | ZohoObjectResponse
      >(
        accessToken,

        `${path}${separator}page=${page}&per_page=100`,
      );

    if (Array.isArray(payload)) {
      allRecords.push(...payload);

      break;
    }

    const rows =
      payload[responseKey];

    if (Array.isArray(rows)) {
      allRecords.push(
        ...(rows as T[]),
      );
    }

    if (
      !payload.page_info
        ?.has_next_page
    ) {
      break;
    }

    page += 1;

    if (page > 100) {
      throw new Error(
        `Zoho pagination safety limit reached for ${path}.`,
      );
    }
  }

  return allRecords;
}

// ======================================================
// ZOHO USERS
// ======================================================

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

async function fetchProjectUsers(
  accessToken: string,
  portalId: string,
  projectId: string,
): Promise<ZohoUser[]> {
  const payload =
    await zohoProjectsRequest<
      | ZohoUser[]
      | {
          users?: ZohoUser[];
        }
    >(
      accessToken,

      `/restapi/portal/${portalId}/projects/${projectId}/users/?user_type=active`,
    );

  return Array.isArray(payload)
    ? payload
    : payload.users ?? [];
}

// ======================================================
// IMPORTANT:
// GET TASK OWNERS
// ======================================================

function getTaskAssignees(
  task: ZohoTask,
): ZohoUser[] {
  /*
   * YOUR ZOHO ACCOUNT RETURNS:
   *
   * owners_and_work: {
   *   owners: [...]
   * }
   *
   * This must be checked first.
   */

  if (
    Array.isArray(
      task.owners_and_work
        ?.owners,
    )
  ) {
    return (
      task.owners_and_work
        ?.owners ??
      []
    );
  }

  /*
   * Fallback formats.
   */

  if (
    Array.isArray(
      task.assignees,
    )
  ) {
    return task.assignees;
  }

  if (
    Array.isArray(
      task.assignee,
    )
  ) {
    return task.assignee;
  }

  if (task.assignee) {
    return [
      task.assignee,
    ];
  }

  if (
    Array.isArray(
      task.owners,
    )
  ) {
    return task.owners;
  }

  if (task.owner) {
    return [
      task.owner,
    ];
  }

  return [];
}

// ======================================================
// PROJECT MATCHING
// ======================================================

function findLocalProject(
  zohoProject: ZohoProject,
  localProjects: LocalProject[],
): LocalProject | null {
  const zohoName =
    normalize(
      zohoProject.name,
    );

  if (!zohoName) {
    return null;
  }

  // ---------------------------------------
  // 1. MASTER JOB NO
  // ---------------------------------------

  const masterMatches =
    localProjects.filter(
      (project) =>
        normalize(
          project.master_job_no,
        ) === zohoName,
    );

  if (
    masterMatches.length === 1
  ) {
    return masterMatches[0];
  }

  // ---------------------------------------
  // 2. CODE + NAME
  // ---------------------------------------

  const reconstructedMatches =
    localProjects.filter(
      (project) => {
        const reconstructed =
          normalize(
            `${
              project.code ?? ''
            }/${project.name}`,
          );

        return (
          reconstructed ===
          zohoName
        );
      },
    );

  if (
    reconstructedMatches.length ===
    1
  ) {
    return (
      reconstructedMatches[0]
    );
  }

  // ---------------------------------------
  // 3. EXACT NAME
  // ---------------------------------------

  const exactNameMatches =
    localProjects.filter(
      (project) =>
        normalize(
          project.name,
        ) === zohoName,
    );

  if (
    exactNameMatches.length ===
    1
  ) {
    return exactNameMatches[0];
  }

  return null;
}

// ======================================================
// EMPLOYEE MATCHING
// ======================================================

function findLocalMember(
  zohoUser: ZohoUser,
  localMembers: LocalMember[],
): MatchResult {
  const zohoId =
    getZohoUserId(
      zohoUser,
    );

  // ---------------------------------------
  // 1. EXISTING ZOHO USER ID
  // ---------------------------------------

  if (zohoId) {
    const candidates =
      localMembers.filter(
        (member) =>
          member.zoho_user_id ===
          zohoId,
      );

    if (
      candidates.length === 1
    ) {
      return {
        member:
          candidates[0],

        matchedBy:
          'ZOHO_ID',

        ambiguous:
          false,
      };
    }

    if (
      candidates.length > 1
    ) {
      return {
        member: null,

        matchedBy:
          'NONE',

        ambiguous:
          true,
      };
    }
  }

  // ---------------------------------------
  // 2. EMAIL
  // ---------------------------------------

  const email =
    normalize(
      zohoUser.email,
    );

  if (email) {
    const candidates =
      localMembers.filter(
        (member) =>
          normalize(
            member.email,
          ) === email,
      );

    if (
      candidates.length === 1
    ) {
      return {
        member:
          candidates[0],

        matchedBy:
          'EMAIL',

        ambiguous:
          false,
      };
    }

    if (
      candidates.length > 1
    ) {
      return {
        member: null,

        matchedBy:
          'NONE',

        ambiguous:
          true,
      };
    }
  }

  // ---------------------------------------
  // 3. EXACT NORMALIZED NAME
  // ---------------------------------------

  const name =
    normalize(
      getZohoUserName(
        zohoUser,
      ),
    );

  if (name) {
    const candidates =
      localMembers.filter(
        (member) =>
          normalize(
            member.name,
          ) === name,
      );

    if (
      candidates.length === 1
    ) {
      return {
        member:
          candidates[0],

        matchedBy:
          'NAME',

        ambiguous:
          false,
      };
    }

    if (
      candidates.length > 1
    ) {
      return {
        member: null,

        matchedBy:
          'NONE',

        ambiguous:
          true,
      };
    }
  }

  return {
    member: null,

    matchedBy:
      'NONE',

    ambiguous:
      false,
  };
}

function buildUserPreview(
  zohoUser: ZohoUser,
  localMembers: LocalMember[],
): UserPreview {
  const result =
    findLocalMember(
      zohoUser,
      localMembers,
    );

  return {
    zohoUserId:
      getZohoUserId(
        zohoUser,
      ) || null,

    zohoName:
      getZohoUserName(
        zohoUser,
      ),

    zohoEmail:
      zohoUser.email ??
      null,

    matched:
      Boolean(
        result.member,
      ),

    ambiguous:
      result.ambiguous,

    matchedBy:
      result.matchedBy,

    localMemberId:
      result.member
        ?.id ??
      null,

    localName:
      result.member
        ?.name ??
      null,

    department:
      result.member
        ?.department_name ??
      null,

    team:
      result.member
        ?.team ??
      null,

    workValue:
      zohoUser.work_values ??
      null,
  };
}

// ======================================================
// MAIN
// ======================================================

export async function GET() {
  try {
    // ==================================================
    // 1. CONNECTION
    // ==================================================

    const connection =
      await getZohoConnection();

    if (!connection) {
      return Response.json(
        {
          error:
            'Zoho is not connected. Open /api/zoho/connect first.',
        },
        {
          status: 400,
        },
      );
    }

    // ==================================================
    // 2. ACCESS TOKEN
    // ==================================================

    const tokenResponse =
      await refreshZohoAccessToken(
        connection.refreshToken,
      );

    const accessToken =
      tokenResponse.access_token;

    if (!accessToken) {
      throw new Error(
        'Zoho did not return a fresh access token.',
      );
    }

    const portalId =
      connection.portalId;

    // ==================================================
    // 3. LOCAL DATABASE
    // ==================================================

    const [
      localProjectResult,
      localMemberResult,
    ] =
      await Promise.all([
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
      ]);

    const localProjects =
      localProjectResult.rows;

    const localMembers =
      localMemberResult.rows;

    // ==================================================
    // 4. PORTAL USERS
    // ==================================================

    let portalUsers:
      ZohoUser[] = [];

    let portalUsersError:
      string | null = null;

    try {
      portalUsers =
        await fetchPortalUsers(
          accessToken,
          portalId,
        );
    } catch (error) {
      portalUsersError =
        error instanceof Error
          ? error.message
          : 'Could not load Zoho portal users.';
    }

    const portalUserPreview =
      portalUsers.map(
        (user) =>
          buildUserPreview(
            user,
            localMembers,
          ),
      );

    const matchedPortalUsers =
      portalUserPreview.filter(
        (user) =>
          user.matched,
      ).length;

    const unmatchedPortalUsers =
      portalUserPreview.filter(
        (user) =>
          !user.matched,
      );

    // ==================================================
    // 5. ZOHO PROJECTS
    // ==================================================

    const zohoProjects =
      await fetchAllV3<
        ZohoProject
      >(
        accessToken,

        `/api/v3/portal/${portalId}/projects`,

        'projects',
      );

    let matchedProjects = 0;

    let unmatchedProjects = 0;

    let totalTasks = 0;

    let closedTasks = 0;

    let openTasks = 0;

    let tasksWithoutAssignee = 0;

    let tasksWithUnmatchedAssignee =
      0;

    const globalUnmatchedUsers =
      new Map<
        string,
        {
          zohoUserId:
            string | null;

          name: string;

          email:
            string | null;

          foundInProjects:
            string[];
        }
      >();

    const projectPreview:
      Array<
        Record<
          string,
          unknown
        >
      > = [];

    // ==================================================
    // 6. EACH PROJECT
    // ==================================================

    for (
      const zohoProject
      of zohoProjects
    ) {
      const zohoProjectId =
        String(
          zohoProject.id,
        );

      const localProject =
        findLocalProject(
          zohoProject,
          localProjects,
        );

      if (localProject) {
        matchedProjects += 1;
      } else {
        unmatchedProjects += 1;
      }

      // =================================================
      // PROJECT MEMBERS
      // =================================================

      let projectUsers:
        ZohoUser[] = [];

      let projectUsersError:
        string | null = null;

      try {
        projectUsers =
          await fetchProjectUsers(
            accessToken,
            portalId,
            zohoProjectId,
          );
      } catch (error) {
        projectUsersError =
          error instanceof Error
            ? error.message
            : 'Could not load project users.';
      }

      const mappedProjectUsers =
        projectUsers.map(
          (user) =>
            buildUserPreview(
              user,
              localMembers,
            ),
        );

      // =================================================
      // UNMATCHED PROJECT USERS
      // =================================================

      for (
        const user
        of mappedProjectUsers
      ) {
        if (user.matched) {
          continue;
        }

        const key =
          user.zohoUserId ??
          user.zohoEmail ??
          normalize(
            user.zohoName,
          );

        if (!key) {
          continue;
        }

        const projectName =
          zohoProject.name ??
          '';

        const existing =
          globalUnmatchedUsers.get(
            key,
          );

        if (existing) {
          if (
            !existing
              .foundInProjects
              .includes(
                projectName,
              )
          ) {
            existing
              .foundInProjects
              .push(
                projectName,
              );
          }
        } else {
          globalUnmatchedUsers.set(
            key,
            {
              zohoUserId:
                user.zohoUserId,

              name:
                user.zohoName,

              email:
                user.zohoEmail,

              foundInProjects: [
                projectName,
              ],
            },
          );
        }
      }

      // =================================================
      // FETCH TASKS
      // =================================================

      let tasks:
        ZohoTask[] = [];

      let tasksError:
        string | null = null;

      try {
        tasks =
          await fetchAllV3<
            ZohoTask
          >(
            accessToken,

            `/api/v3/portal/${portalId}/projects/${zohoProjectId}/tasks`,

            'tasks',
          );
      } catch (error) {
        tasksError =
          error instanceof Error
            ? error.message
            : 'Could not load project tasks.';
      }

      totalTasks +=
        tasks.length;

      let projectClosedTasks = 0;

      let projectOpenTasks = 0;

      let projectTasksWithoutAssignee =
        0;

      let projectTasksWithUnmatchedAssignee =
        0;

      // =================================================
      // MEMBER -> TASK MAP
      // =================================================

      const memberTaskMap =
        new Map<
          string,
          MemberTaskSummary
        >();

      /*
       * Add project members even if
       * they currently have zero tasks.
       */
      for (
        const projectUser
        of projectUsers
      ) {
        const mapped =
          buildUserPreview(
            projectUser,
            localMembers,
          );

        const key =
          mapped.localMemberId ??
          mapped.zohoUserId ??
          mapped.zohoEmail ??
          normalize(
            mapped.zohoName,
          );

        if (!key) {
          continue;
        }

        memberTaskMap.set(
          key,
          {
            zohoUserId:
              mapped.zohoUserId,

            localMemberId:
              mapped.localMemberId,

            name:
              mapped.localName ??
              mapped.zohoName,

            zohoName:
              mapped.zohoName,

            email:
              mapped.zohoEmail,

            department:
              mapped.department,

            team:
              mapped.team,

            matched:
              mapped.matched,

            matchedBy:
              mapped.matchedBy,

            isZohoProjectMember:
              true,

            assignedTaskCount:
              0,

            closedTaskCount:
              0,

            openTaskCount:
              0,

            tasks: [],
          },
        );
      }

      // =================================================
      // TASK DETAILS
      // =================================================

      const taskPreview:
        TaskPreview[] = [];

      for (
        const task
        of tasks
      ) {
        /*
         * Use both fields.
         *
         * Zoho gives:
         * status.is_closed_type
         * and
         * is_completed
         */
        const isClosed =
          task.is_completed ===
            true ||
          task.status
            ?.is_closed_type ===
            true;

        if (isClosed) {
          projectClosedTasks += 1;

          closedTasks += 1;
        } else {
          projectOpenTasks += 1;

          openTasks += 1;
        }

        // ===============================================
        // EXACT TASK OWNERS
        // ===============================================

        const zohoAssignees =
          getTaskAssignees(
            task,
          );

        if (
          zohoAssignees.length ===
          0
        ) {
          projectTasksWithoutAssignee +=
            1;

          tasksWithoutAssignee +=
            1;
        }

        const mappedAssignees =
          zohoAssignees.map(
            (assignee) =>
              buildUserPreview(
                assignee,
                localMembers,
              ),
          );

        const hasUnmatchedAssignee =
          mappedAssignees.some(
            (assignee) =>
              !assignee.matched,
          );

        if (
          hasUnmatchedAssignee
        ) {
          projectTasksWithUnmatchedAssignee +=
            1;

          tasksWithUnmatchedAssignee +=
            1;
        }

        const status =
          task.status?.name ??
          (
            isClosed
              ? 'Completed'
              : 'Open'
          );

        const startDate =
          task.start_date ??
          null;

        /*
         * Your API uses end_date.
         */
        const endDate =
          task.end_date ??
          task.due_date ??
          null;

        const completionPercentage =
          typeof task
            .completion_percentage ===
          'number'
            ? task
                .completion_percentage
            : isClosed
              ? 100
              : 0;

        taskPreview.push({
          zohoTaskId:
            String(
              task.id,
            ),

          prefix:
            task.prefix ??
            null,

          name:
            task.name ??
            '',

          status,

          isClosed,

          completionPercentage,

          priority:
            task.priority ??
            null,

          category:
            task.task_category ??
            null,

          taskList:
            task.tasklist
              ?.name ??
            null,

          startDate,

          endDate,

          createdTime:
            task.created_time ??
            null,

          lastModifiedTime:
            task.last_modified_time ??
            null,

          completedTime:
            task.completed_time ??
            null,

          assigneeCount:
            mappedAssignees.length,

          hasUnmatchedAssignee,

          assignees:
            mappedAssignees,
        });

        // ===============================================
        // MEMBER -> TASK RELATIONSHIP
        // ===============================================

        for (
          const mapped
          of mappedAssignees
        ) {
          const key =
            mapped.localMemberId ??
            mapped.zohoUserId ??
            mapped.zohoEmail ??
            normalize(
              mapped.zohoName,
            );

          if (!key) {
            continue;
          }

          let member =
            memberTaskMap.get(
              key,
            );

          /*
           * The person can own a task even if
           * project-users API didn't return them.
           */
          if (!member) {
            member = {
              zohoUserId:
                mapped.zohoUserId,

              localMemberId:
                mapped.localMemberId,

              name:
                mapped.localName ??
                mapped.zohoName,

              zohoName:
                mapped.zohoName,

              email:
                mapped.zohoEmail,

              department:
                mapped.department,

              team:
                mapped.team,

              matched:
                mapped.matched,

              matchedBy:
                mapped.matchedBy,

              isZohoProjectMember:
                false,

              assignedTaskCount:
                0,

              closedTaskCount:
                0,

              openTaskCount:
                0,

              tasks: [],
            };

            memberTaskMap.set(
              key,
              member,
            );
          }

          member.assignedTaskCount +=
            1;

          if (isClosed) {
            member.closedTaskCount +=
              1;
          } else {
            member.openTaskCount +=
              1;
          }

          member.tasks.push({
            zohoTaskId:
              String(
                task.id,
              ),

            prefix:
              task.prefix ??
              null,

            name:
              task.name ??
              '',

            status,

            isClosed,

            completionPercentage,

            startDate,

            endDate,
          });
        }
      }

      // =================================================
      // SORT MEMBER WORK
      // =================================================

      const memberWork =
        Array.from(
          memberTaskMap.values(),
        ).sort(
          (
            first,
            second,
          ) =>
            second
              .assignedTaskCount -
            first
              .assignedTaskCount,
        );

      // =================================================
      // PROJECT RESULT
      // =================================================

      projectPreview.push({
        zohoProjectId,

        zohoProjectName:
          zohoProject.name ??
          '',

        zohoStatus:
          typeof zohoProject
            .status ===
          'string'
            ? zohoProject
                .status
            : zohoProject
                .status
                ?.name ??
              '',

        // -----------------------------------------------
        // LOCAL MATCH
        // -----------------------------------------------

        localProjectId:
          localProject?.id ??
          null,

        localProjectName:
          localProject?.name ??
          null,

        localMasterJobNo:
          localProject
            ?.master_job_no ??
          null,

        projectMatched:
          Boolean(
            localProject,
          ),

        // -----------------------------------------------
        // MEMBERS
        // -----------------------------------------------

        projectUserCount:
          projectUsers.length,

        matchedProjectUsers:
          mappedProjectUsers.filter(
            (user) =>
              user.matched,
          ).length,

        unmatchedProjectUsers:
          mappedProjectUsers.filter(
            (user) =>
              !user.matched,
          ).length,

        projectUsersError,

        projectUsers:
          mappedProjectUsers,

        // -----------------------------------------------
        // TASK SUMMARY
        // -----------------------------------------------

        taskCount:
          tasks.length,

        closedTasks:
          projectClosedTasks,

        openTasks:
          projectOpenTasks,

        tasksWithoutAssignee:
          projectTasksWithoutAssignee,

        tasksWithUnmatchedAssignee:
          projectTasksWithUnmatchedAssignee,

        tasksError,

        // -----------------------------------------------
        // MEMBER -> TASKS
        // -----------------------------------------------

        memberWork,

        // -----------------------------------------------
        // TASK -> MEMBER(S)
        // -----------------------------------------------

        tasks:
          taskPreview,
      });
    }

    // ==================================================
    // FINAL RESPONSE
    // ==================================================

    return Response.json({
      mode:
        'PREVIEW_ONLY',

      databaseChanged:
        false,

      message:
        'Zoho Project -> Member -> Task relationships are being read directly from Zoho. No local data has been modified.',

      portal: {
        id:
          portalId,

        name:
          connection.portalName,
      },

      portalUsersError,

      summary: {
        localProjects:
          localProjects.length,

        zohoProjects:
          zohoProjects.length,

        matchedProjects,

        unmatchedProjects,

        localActiveMembers:
          localMembers.length,

        zohoActivePortalUsers:
          portalUsers.length,

        matchedPortalUsers,

        unmatchedPortalUsers:
          unmatchedPortalUsers.length,

        totalZohoTasks:
          totalTasks,

        closedZohoTasks:
          closedTasks,

        openZohoTasks:
          openTasks,

        tasksWithoutAssignee,

        tasksWithUnmatchedAssignee,

        uniqueUnmatchedProjectUsers:
          globalUnmatchedUsers.size,
      },

      unmatchedPortalUsers,

      unmatchedProjectUsers:
        Array.from(
          globalUnmatchedUsers.values(),
        ),

      projects:
        projectPreview,
    });
  } catch (error) {
    console.error(
      'Zoho preview failed:',
      error,
    );

    return Response.json(
      {
        mode:
          'PREVIEW_ONLY',

        databaseChanged:
          false,

        error:
          error instanceof Error
            ? error.message
            : 'Zoho preview failed.',
      },
      {
        status: 500,
      },
    );
  }
}