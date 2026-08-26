import {
  cookies,
} from 'next/headers';

import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  exchangeZohoCode,
  zohoProjectsRequest,
} from '@/lib/zoho/oauth';

import {
  saveZohoConnection,
} from '@/lib/zoho/token-store';

interface ZohoPortal {
  id:
    string | number;

  portal_name?: string;

  org_name?: string;

  project_plan?: string;

  timezone?: string;
}

interface ZohoProject {
  id:
    string | number;

  name?: string;

  status?:
    | string
    | {
        id?: string;
        name?: string;
      };
}

interface ProjectsResponse {
  projects?:
    ZohoProject[];

  page_info?: {
    page?: number;
    per_page?: number;

    has_next_page?:
      boolean;
  };
}

export async function GET(
  request: NextRequest,
) {
  try {
    const code =
      request.nextUrl
        .searchParams
        .get('code');

    const returnedState =
      request.nextUrl
        .searchParams
        .get('state');

    const oauthError =
      request.nextUrl
        .searchParams
        .get('error');

    if (oauthError) {
      return NextResponse.json(
        {
          connected:
            false,

          error:
            oauthError,
        },
        {
          status:
            400,
        },
      );
    }

    if (!code) {
      return NextResponse.json(
        {
          connected:
            false,

          error:
            'Zoho did not return an authorization code.',
        },
        {
          status:
            400,
        },
      );
    }

    const cookieStore =
      await cookies();

    const storedState =
      cookieStore
        .get(
          'zoho_oauth_state',
        )
        ?.value;

    if (
      !returnedState ||
      !storedState ||
      returnedState !==
        storedState
    ) {
      return NextResponse.json(
        {
          connected:
            false,

          error:
            'Invalid OAuth state.',
        },
        {
          status:
            400,
        },
      );
    }

    cookieStore.delete(
      'zoho_oauth_state',
    );

    // --------------------------------------
    // EXCHANGE CODE
    // --------------------------------------

    const tokens =
      await exchangeZohoCode(
        code,
      );

    const accessToken =
      tokens.access_token;

    if (!accessToken) {
      throw new Error(
        'Zoho did not provide an access token.',
      );
    }

    // --------------------------------------
    // GET PORTALS
    // --------------------------------------

    const portalPayload =
      await zohoProjectsRequest<
        | ZohoPortal[]
        | {
            portals?:
              ZohoPortal[];
          }
      >(
        accessToken,
        '/api/v3/portals',
      );

    const portals =
      Array.isArray(
        portalPayload,
      )
        ? portalPayload
        : portalPayload
            .portals ??
          [];

    if (
      portals.length === 0
    ) {
      return NextResponse.json({
        connected:
          true,

        message:
          'OAuth succeeded, but no Zoho Projects portal was found.',
      });
    }

    const portal =
      portals[0];

    const portalName =
      portal.portal_name ??
      portal.org_name ??
      '';

    // --------------------------------------
    // SAVE CONNECTION
    // --------------------------------------

    await saveZohoConnection({
      portalId:
        String(
          portal.id,
        ),

      portalName,

      refreshToken:
        tokens.refresh_token,

      apiDomain:
        tokens.api_domain,
    });

    // --------------------------------------
    // GET PROJECTS
    // --------------------------------------

    const projectsPayload =
      await zohoProjectsRequest<
        | ProjectsResponse
        | ZohoProject[]
      >(
        accessToken,

        `/api/v3/portal/${portal.id}/projects?page=1&per_page=100`,
      );

    const projects =
      Array.isArray(
        projectsPayload,
      )
        ? projectsPayload
        : projectsPayload
            .projects ??
          [];

    console.log(
      '\n==============================',
    );

    console.log(
      'ZOHO OAUTH CONNECTED ✅',
    );

    console.log(
      '==============================',
    );

    console.log(
      'Portal:',
      {
        id:
          portal.id,

        portalName,

        organization:
          portal.org_name,
      },
    );

    console.log(
      `Projects found: ${projects.length}`,
    );

    console.log(
      'Refresh token stored:',
      Boolean(
        tokens.refresh_token,
      ),
    );

    console.log(
      '==============================\n',
    );

    return NextResponse.json({
      connected:
        true,

      portal: {
        id:
          String(
            portal.id,
          ),

        name:
          portalName,
      },

      projectCount:
        projects.length,

      refreshTokenReceived:
        Boolean(
          tokens.refresh_token,
        ),

      connectionStored:
        true,

      projects:
        projects.map(
          (project) => ({
            zohoProjectId:
              String(
                project.id,
              ),

            name:
              project.name ??
              '',

            status:
              typeof project.status ===
              'string'
                ? project.status
                : project.status
                    ?.name ??
                  '',
          }),
        ),

      message:
        'Zoho OAuth is connected and the secure connection has been stored. No local project, member, or task data has been modified.',
    });
  } catch (error) {
    console.error(
      'Zoho OAuth callback error:',
      error,
    );

    return NextResponse.json(
      {
        connected:
          false,

        error:
          error instanceof Error
            ? error.message
            : 'Unknown Zoho OAuth error.',
      },
      {
        status:
          500,
      },
    );
  }
}