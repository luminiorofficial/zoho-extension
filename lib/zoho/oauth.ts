const ZOHO_SCOPES = [
  'ZohoProjects.portals.READ',
  'ZohoProjects.projects.READ',
  'ZohoProjects.users.READ',
  'ZohoProjects.tasks.READ',
].join(',');

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

export function getZohoConfig() {
  return {
    clientId: requiredEnv('ZOHO_CLIENT_ID'),
    clientSecret: requiredEnv('ZOHO_CLIENT_SECRET'),
    redirectUri: requiredEnv('ZOHO_REDIRECT_URI'),

    accountsUrl:
      process.env.ZOHO_ACCOUNTS_URL ??
      'https://accounts.zoho.in',

    projectsApiUrl:
      process.env.ZOHO_PROJECTS_API_URL ??
      'https://projectsapi.zoho.in',

    scopes: ZOHO_SCOPES,
  };
}

export function getZohoAuthorizationUrl(
  state: string,
): string {
  const config = getZohoConfig();

  const params = new URLSearchParams({
    scope: config.scopes,
    client_id: config.clientId,
    response_type: 'code',
    access_type: 'offline',
    redirect_uri: config.redirectUri,
    prompt: 'consent',
    state,
  });

  return `${config.accountsUrl}/oauth/v2/auth?${params.toString()}`;
}

export interface ZohoTokenResponse {
  access_token?: string;
  refresh_token?: string;
  api_domain?: string;
  token_type?: string;
  expires_in?: number;

  error?: string;
}

export async function exchangeZohoCode(
  code: string,
): Promise<ZohoTokenResponse> {
  const config = getZohoConfig();

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code,
  });

  const response = await fetch(
    `${config.accountsUrl}/oauth/v2/token`,
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/x-www-form-urlencoded',
      },
      body,
      cache: 'no-store',
    },
  );

  const data =
    (await response.json()) as ZohoTokenResponse;

  if (!response.ok || !data.access_token) {
    console.error(
      'Zoho token exchange failed:',
      data.error ?? response.statusText,
    );

    throw new Error(
      data.error ??
        `Zoho token request failed (${response.status}).`,
    );
  }

  return data;
}

export async function zohoProjectsRequest<T>(
  accessToken: string,
  path: string,
): Promise<T> {
  const config = getZohoConfig();

  const response = await fetch(
    `${config.projectsApiUrl}${path}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    const body = await response.text();

    console.error(
      'Zoho Projects API failed:',
      response.status,
      body,
    );

    throw new Error(
      `Zoho Projects API returned ${response.status}.`,
    );
  }

  return (await response.json()) as T;
}