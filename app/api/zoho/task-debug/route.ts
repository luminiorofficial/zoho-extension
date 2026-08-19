import {
  refreshZohoAccessToken,
  zohoProjectsRequest,
} from '@/lib/zoho/oauth';

import {
  getZohoConnection,
} from '@/lib/zoho/token-store';

interface ZohoProject {
  id: string | number;
  name?: string;
}

interface ProjectResponse {
  projects?: ZohoProject[];

  page_info?: {
    page?: number;
    per_page?: number;
    has_next_page?: boolean;
  };
}

interface TasksResponse {
  tasks?: Record<string, unknown>[];

  page_info?: {
    page?: number;
    per_page?: number;
    has_next_page?: boolean;
  };
}

export async function GET() {
  try {
    // ==========================================
    // 1. GET STORED CONNECTION
    // ==========================================

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

    // ==========================================
    // 2. FRESH ACCESS TOKEN
    // ==========================================

    const tokenResponse =
      await refreshZohoAccessToken(
        connection.refreshToken,
      );

    const accessToken =
      tokenResponse.access_token;

    if (!accessToken) {
      throw new Error(
        'Could not get Zoho access token.',
      );
    }

    const portalId =
      connection.portalId;

    // ==========================================
    // 3. FETCH FIRST PROJECT
    // ==========================================

    const projectPayload =
      await zohoProjectsRequest<
        ProjectResponse | ZohoProject[]
      >(
        accessToken,

        `/api/v3/portal/${portalId}/projects?page=1&per_page=100`,
      );

    const projects =
      Array.isArray(projectPayload)
        ? projectPayload
        : projectPayload.projects ??
          [];

    if (projects.length === 0) {
      return Response.json({
        error:
          'No Zoho projects found.',
      });
    }

    /*
     * Prefer Artist Decode because we already
     * know this project exists in your Zoho.
     *
     * Otherwise use the first project.
     */

    const selectedProject =
      projects.find(
        (project) =>
          project.name
            ?.toLowerCase()
            .includes(
              'artist decode',
            ),
      ) ??
      projects[0];

    const projectId =
      String(
        selectedProject.id,
      );

    // ==========================================
    // 4. FETCH TASKS
    // ==========================================

    const taskPayload =
      await zohoProjectsRequest<
        TasksResponse |
        Record<
          string,
          unknown
        >[]
      >(
        accessToken,

        `/api/v3/portal/${portalId}/projects/${projectId}/tasks?page=1&per_page=10`,
      );

    const tasks =
      Array.isArray(taskPayload)
        ? taskPayload
        : taskPayload.tasks ??
          [];

    // ==========================================
    // 5. RETURN FIRST 5 RAW TASKS
    // ==========================================

    const firstTasks =
      tasks
        .slice(0, 5)
        .map(
          (
            task,
            index,
          ) => ({
            number:
              index + 1,

            // Shows every property Zoho sent
            keys:
              Object.keys(
                task,
              ),

            id:
              task.id ??
              null,

            name:
              task.name ??
              null,

            // V3 possibilities
            assignee:
              task.assignee ??
              null,

            assignees:
              task.assignees ??
              null,

            owner:
              task.owner ??
              null,

            owners:
              task.owners ??
              null,

            // Older Zoho shape
            details:
              task.details ??
              null,

            personResponsible:
              task.person_responsible ??
              null,

            personResponsibleZpuid:
              task.person_responsible_zpuid ??
              null,

            // Status debugging
            status:
              task.status ??
              null,

            completed:
              task.completed ??
              null,

            percentComplete:
              task.percent_complete ??
              null,

            // Entire object so we cannot miss
            // any undocumented/tenant-specific field
            raw:
              task,
          }),
        );

    return Response.json({
      mode:
        'TASK_DEBUG',

      databaseChanged:
        false,

      portal: {
        id:
          portalId,

        name:
          connection.portalName,
      },

      project: {
        id:
          projectId,

        name:
          selectedProject.name ??
          '',
      },

      tasksReturned:
        tasks.length,

      firstTasks,
    });
  } catch (error) {
    console.error(
      'Zoho task debug error:',
      error,
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Zoho task debug failed.',
      },
      {
        status: 500,
      },
    );
  }
}