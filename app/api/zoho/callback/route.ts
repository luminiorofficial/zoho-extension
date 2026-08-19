import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import {
  exchangeZohoCode,
  zohoProjectsRequest,
} from '@/lib/zoho/oauth';

interface ZohoPortal {
  id: string | number;
  portal_name?: string;
  org_name?: string;
  project_plan?: string;
  timezone?: string;
}

interface ZohoProject {
  id: string | number;
  name?: string;
  status?: string | {
    id?: string;
    name?: string;
  };
  owner?: {
    zpuid?: string;
    name?: string;
    email?: string;
  };
}

interface ProjectsResponse {
  projects?: ZohoProject[];

  page_info?: {
    page?: number;
    per_page?: number;
    has_next_page?: boolean;
  };
}

export async function GET(request: NextRequest) {
  try {
    const code =
      request.nextUrl.searchParams.get('code');

    const returnedState =
      request.nextUrl.searchParams.get('state');

    const error =
      request.nextUrl.searchParams.get('error');

    if (error) {
      return NextResponse.json(
        {
          connected: false,
          error,
        },
        {
          status: 400,
        },
      );
    }

    if (!code) {
      return NextResponse.json(
        {
          connected: false,
          error:
            'Zoho did not return an authorization code.',
        },
        {
          status: 400,
        },
      );
    }

    const cookieStore = await cookies();

    const storedState =
      cookieStore.get('zoho_oauth_state')?.value;

    if (
      !returnedState ||
      !storedState ||
      returnedState !== storedState
    ) {
      return NextResponse.json(
        {
          connected: false,
          error: 'Invalid OAuth state.',
        },
        {
          status: 400,
        },
      );
    }

    cookieStore.delete('zoho_oauth_state');

    // Exchange the one-time code for tokens.
    const tokens = await exchangeZohoCode(code);

    const accessToken = tokens.access_token;

    if (!accessToken) {
      throw new Error(
        'Zoho did not provide an access token.',
      );
    }

    // -------------------------------
    // GET ZOHO PORTALS
    // -------------------------------

    const portalPayload =
      await zohoProjectsRequest<
        ZohoPortal[] | { portals?: ZohoPortal[] }
      >(
        accessToken,
        '/api/v3/portals',
      );

    const portals = Array.isArray(portalPayload)
      ? portalPayload
      : portalPayload.portals ?? [];

    if (portals.length === 0) {
      return NextResponse.json({
        connected: true,
        message:
          'OAuth succeeded, but no Zoho Projects portal was found.',
      });
    }

    const portal = portals[0];

    // -------------------------------
    // GET ZOHO PROJECTS
    // -------------------------------

    const projectsPayload =
      await zohoProjectsRequest<
        ProjectsResponse | ZohoProject[]
      >(
        accessToken,
        `/api/v3/portal/${portal.id}/projects?page=1&per_page=200`,
      );

    const projects = Array.isArray(projectsPayload)
      ? projectsPayload
      : projectsPayload.projects ?? [];

    // Safe debugging.
    // Do NOT print OAuth token values.

    console.log(
      '\n==============================',
    );

    console.log('ZOHO OAUTH CONNECTED ✅');

    console.log(
      '==============================',
    );

    console.log('Portal:', {
      id: portal.id,
      portalName: portal.portal_name,
      organization: portal.org_name,
    });

    console.log(
      `Projects found: ${projects.length}`,
    );

    console.table(
      projects.map((project) => ({
        zohoProjectId: String(project.id),
        name: project.name ?? '',
        status:
          typeof project.status === 'string'
            ? project.status
            : project.status?.name ?? '',
      })),
    );

    console.log(
      'Refresh token received:',
      Boolean(tokens.refresh_token),
    );

    console.log(
      '==============================\n',
    );

    return NextResponse.json({
      connected: true,

      portal: {
        id: String(portal.id),
        name:
          portal.portal_name ??
          portal.org_name ??
          '',
      },

      projectCount: projects.length,

      refreshTokenReceived:
        Boolean(tokens.refresh_token),

      projects: projects.map((project) => ({
        zohoProjectId: String(project.id),
        name: project.name ?? '',
        status:
          typeof project.status === 'string'
            ? project.status
            : project.status?.name ?? '',
      })),

      message:
        'Zoho OAuth is working. No local project data has been changed yet.',
    });
  } catch (error) {
    console.error(
      'Zoho OAuth callback error:',
      error,
    );

    return NextResponse.json(
      {
        connected: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown Zoho OAuth error.',
      },
      {
        status: 500,
      },
    );
  }
}