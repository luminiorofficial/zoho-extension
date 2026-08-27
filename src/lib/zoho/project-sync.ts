import 'server-only';

import type { PoolClient, QueryResultRow } from 'pg';

import { db } from '@/lib/db';
import {
  refreshZohoAccessToken,
  zohoProjectsRequest,
} from '@/lib/zoho/oauth';
import {
  getZohoProjectCode,
  normalizeZohoProjectName,
  projectFieldsFromZoho,
  type LocalProjectFields,
  type ZohoProjectRecord,
} from '@/lib/zoho/project-sync-utils';
import { getZohoConnection } from '@/lib/zoho/token-store';

const PAGE_SIZE = 100;
const DEFAULT_SYNC_MAX_AGE_MS = 15_000;

interface ZohoProjectsResponse {
  projects?: ZohoProjectRecord[];
  project?: ZohoProjectRecord;
  page_info?: {
    has_next_page?: boolean;
  };
}

interface MappingRow extends QueryResultRow {
  id: string;
  local_id: string;
  zoho_entity_id: string | null;
  zoho_project_id: string | null;
  sync_status: string | null;
}

interface LocalProjectRow extends QueryResultRow {
  id: string;
  department_id: string;
  name: string;
  code: string | null;
  master_job_no: string | null;
}

interface ProjectContext {
  departmentId: string;
  goalId: string;
}

interface ProjectUpdate extends LocalProjectFields {
  localId: string;
  zohoProjectId: string;
  updateFromZoho: boolean;
}

export interface ZohoProjectSyncResult {
  fetched: number;
  created: number;
  mappedToExisting: number;
  alreadyMapped: number;
  projects: Array<{
    zohoProjectId: string;
    localProjectId: string;
    created: boolean;
  }>;
}

type SyncState = {
  completedAt: number;
  promise: Promise<ZohoProjectSyncResult> | null;
  result: ZohoProjectSyncResult | null;
};

const globalForZohoSync = globalThis as unknown as {
  zohoProjectSyncState?: SyncState;
};

const syncState = globalForZohoSync.zohoProjectSyncState ?? {
  completedAt: 0,
  promise: null,
  result: null,
};

globalForZohoSync.zohoProjectSyncState = syncState;

function effectiveZohoId(mapping: MappingRow): string {
  return String(
    mapping.zoho_entity_id ?? mapping.zoho_project_id ?? '',
  ).trim();
}

async function fetchAllZohoProjects(
  accessToken: string,
  portalId: string,
): Promise<ZohoProjectRecord[]> {
  const projects: ZohoProjectRecord[] = [];

  for (let page = 1; page <= 100; page += 1) {
    const payload = await zohoProjectsRequest<
      ZohoProjectsResponse | ZohoProjectRecord[]
    >(
      accessToken,
      `/api/v3/portal/${portalId}/projects?page=${page}&per_page=${PAGE_SIZE}`,
    );

    const pageProjects = Array.isArray(payload)
      ? payload
      : payload.projects ?? [];

    projects.push(...pageProjects);

    const hasNextPage = !Array.isArray(payload)
      && payload.page_info?.has_next_page === true;

    if (!hasNextPage && pageProjects.length < PAGE_SIZE) break;
    if (!hasNextPage && !Array.isArray(payload)) break;
    if (pageProjects.length === 0) break;
  }

  const unique = new Map<string, ZohoProjectRecord>();
  for (const project of projects) {
    const id = String(project.id).trim();
    if (id) unique.set(id, project);
  }

  return [...unique.values()];
}

async function fetchZohoProjectById(
  accessToken: string,
  portalId: string,
  zohoProjectId: string,
): Promise<ZohoProjectRecord | null> {
  try {
    const payload = await zohoProjectsRequest<
      ZohoProjectRecord | ZohoProjectsResponse
    >(
      accessToken,
      `/api/v3/portal/${portalId}/projects/${zohoProjectId}`,
    );

    if ('id' in payload) return payload;
    return payload.project ?? payload.projects?.[0] ?? null;
  } catch {
    return null;
  }
}

async function getProjectContext(
  client: PoolClient,
): Promise<ProjectContext> {
  let department = await client.query<{ id: string }>(
    `
    SELECT id
    FROM departments
    WHERE UPPER(BTRIM(name)) = 'OPERATION'
    ORDER BY is_active DESC, created_at
    LIMIT 1
    `,
  );

  if (!department.rows[0]) {
    department = await client.query<{ id: string }>(
      `
      INSERT INTO departments (name, description, is_active)
      VALUES ('OPERATION', 'Operational project delivery', TRUE)
      RETURNING id
      `,
    );
  } else {
    await client.query(
      `UPDATE departments SET is_active = TRUE, updated_at = NOW() WHERE id = $1`,
      [department.rows[0].id],
    );
  }

  const departmentId = department.rows[0].id;
  let goal = await client.query<{ id: string }>(
    `
    SELECT id
    FROM goals
    WHERE department_id = $1 AND code = 'PROJECT_MASTER'
    ORDER BY is_active DESC, created_at
    LIMIT 1
    `,
    [departmentId],
  );

  if (!goal.rows[0]) {
    goal = await client.query<{ id: string }>(
      `
      INSERT INTO goals (
        department_id, code, title, description,
        status, progress_percent, is_active
      )
      VALUES (
        $1, 'PROJECT_MASTER', 'Current Projects',
        'Current CAC CRM projects, including live Zoho Projects sync.',
        'NOT_STARTED', 0, TRUE
      )
      RETURNING id
      `,
      [departmentId],
    );
  } else {
    await client.query(
      `UPDATE goals SET is_active = TRUE, updated_at = NOW() WHERE id = $1`,
      [goal.rows[0].id],
    );
  }

  return {
    departmentId,
    goalId: goal.rows[0].id,
  };
}

function availableProjectName(
  fields: LocalProjectFields,
  zohoProjectId: string,
  departmentId: string,
  localProjects: LocalProjectRow[],
): string {
  const used = new Set(
    localProjects
      .filter((project) => project.department_id === departmentId)
      .map((project) => project.name.trim().toUpperCase()),
  );

  if (!used.has(fields.name.toUpperCase())) return fields.name;

  const withCode = `${fields.name} (${fields.jobCode ?? zohoProjectId})`;
  if (!used.has(withCode.toUpperCase())) return withCode;

  return `${fields.name} (${zohoProjectId})`;
}

async function syncFetchedProjects(
  projects: ZohoProjectRecord[],
  portalId: string,
): Promise<ZohoProjectSyncResult> {
  const sortedProjects = [...projects].sort((left, right) =>
    String(left.id).localeCompare(String(right.id)),
  );

  const result: ZohoProjectSyncResult = {
    fetched: sortedProjects.length,
    created: 0,
    mappedToExisting: 0,
    alreadyMapped: 0,
    projects: [],
  };

  if (sortedProjects.length === 0) return result;

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const zohoIds = sortedProjects.map((project) => String(project.id));
    await client.query(
      `
      SELECT pg_advisory_xact_lock(hashtextextended(project_id, 0))
      FROM UNNEST($1::text[]) AS project_id
      ORDER BY project_id
      `,
      [zohoIds],
    );

    const [mappingResult, projectResult] = await Promise.all([
      client.query<MappingRow>(
        `
        SELECT id, local_id, zoho_entity_id, zoho_project_id, sync_status
        FROM zoho_mappings
        WHERE entity_type = 'PROJECT'
        ORDER BY updated_at DESC, created_at DESC
        `,
      ),
      client.query<LocalProjectRow>(
        `
        SELECT id, department_id, name, code, master_job_no
        FROM projects
        ORDER BY created_at
        `,
      ),
    ]);

    const mappings = mappingResult.rows;
    const localProjects = projectResult.rows;
    const localById = new Map(localProjects.map((project) => [project.id, project]));
    const mappingByZohoId = new Map<string, MappingRow>();
    const claimedLocalIds = new Set<string>();

    for (const mapping of mappings) {
      claimedLocalIds.add(mapping.local_id);
      const zohoId = effectiveZohoId(mapping);
      if (zohoId && !mappingByZohoId.has(zohoId)) {
        mappingByZohoId.set(zohoId, mapping);
      }
    }

    const remoteCodeCounts = new Map<string, number>();
    for (const project of sortedProjects) {
      const code = getZohoProjectCode(project.name);
      if (code) remoteCodeCounts.set(code, (remoteCodeCounts.get(code) ?? 0) + 1);
    }

    const updates: ProjectUpdate[] = [];
    let context: ProjectContext | null = null;

    for (const zohoProject of sortedProjects) {
      const zohoProjectId = String(zohoProject.id).trim();
      const fields = projectFieldsFromZoho(zohoProject);
      const existingMapping = mappingByZohoId.get(zohoProjectId);
      const mappedProject = existingMapping
        ? localById.get(existingMapping.local_id)
        : null;

      if (existingMapping && mappedProject) {
        updates.push({
          ...fields,
          localId: mappedProject.id,
          zohoProjectId,
          updateFromZoho: existingMapping.sync_status === 'ZOHO_CREATED',
        });
        result.alreadyMapped += 1;
        result.projects.push({
          zohoProjectId,
          localProjectId: mappedProject.id,
          created: false,
        });
        continue;
      }

      const normalizedName = normalizeZohoProjectName(zohoProject.name);
      const exactMasterMatches = localProjects.filter(
        (project) =>
          !claimedLocalIds.has(project.id)
          && normalizeZohoProjectName(project.master_job_no) === normalizedName,
      );

      const code = getZohoProjectCode(zohoProject.name);
      const codeMatches = code && remoteCodeCounts.get(code) === 1
        ? localProjects.filter(
            (project) =>
              !claimedLocalIds.has(project.id)
              && normalizeZohoProjectName(project.code) === code,
          )
        : [];

      const reusable = exactMasterMatches.length === 1
        ? exactMasterMatches[0]
        : codeMatches.length === 1
          ? codeMatches[0]
          : null;

      let localProjectId: string;
      let wasCreated = false;

      if (reusable) {
        localProjectId = reusable.id;
        result.mappedToExisting += 1;
      } else {
        context ??= await getProjectContext(client);
        const projectName = availableProjectName(
          fields,
          zohoProjectId,
          context.departmentId,
          localProjects,
        );

        const inserted = await client.query<{ id: string }>(
          `
          INSERT INTO projects (
            department_id, goal_id, code, name, client_name,
            status, master_job_no, project_type, is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), 'ZOHO_PROJECT', TRUE)
          RETURNING id
          `,
          [
            context.departmentId,
            context.goalId,
            fields.jobCode,
            projectName,
            fields.clientName,
            fields.status,
            fields.masterJobNo,
          ],
        );

        localProjectId = inserted.rows[0].id;
        localProjects.push({
          id: localProjectId,
          department_id: context.departmentId,
          name: projectName,
          code: fields.jobCode,
          master_job_no: fields.masterJobNo,
        });
        localById.set(localProjectId, localProjects[localProjects.length - 1]);
        result.created += 1;
        wasCreated = true;
      }

      claimedLocalIds.add(localProjectId);

      if (existingMapping) {
        await client.query(
          `
          UPDATE zoho_mappings
          SET local_id = $1,
              zoho_entity_id = $2,
              zoho_project_id = $2,
              sync_status = 'ZOHO_CREATED',
              last_synced_at = NOW(),
              updated_at = NOW()
          WHERE id = $3
          `,
          [localProjectId, zohoProjectId, existingMapping.id],
        );
      } else {
        await client.query(
          `
          INSERT INTO zoho_mappings (
            entity_type, local_id, zoho_entity_id, zoho_project_id,
            last_synced_at, sync_status, created_at, updated_at
          )
          VALUES (
            'PROJECT', $1, $2, $2, NOW(), $3, NOW(), NOW()
          )
          ON CONFLICT (entity_type, local_id) DO UPDATE
          SET zoho_entity_id = EXCLUDED.zoho_entity_id,
              zoho_project_id = EXCLUDED.zoho_project_id,
              last_synced_at = NOW(),
              sync_status = EXCLUDED.sync_status,
              updated_at = NOW()
          `,
          [
            localProjectId,
            zohoProjectId,
            wasCreated ? 'ZOHO_CREATED' : 'MAPPED',
          ],
        );
      }

      updates.push({
        ...fields,
        localId: localProjectId,
        zohoProjectId,
        updateFromZoho: wasCreated,
      });
      result.projects.push({
        zohoProjectId,
        localProjectId,
        created: wasCreated,
      });
    }

    await client.query(
      `
      UPDATE projects AS project
      SET is_active = TRUE,
          code = CASE WHEN incoming.update_from_zoho THEN incoming.job_code ELSE project.code END,
          name = CASE
            WHEN incoming.update_from_zoho
             AND NOT EXISTS (
               SELECT 1
               FROM projects AS conflict
               WHERE conflict.department_id = project.department_id
                 AND conflict.id <> project.id
                 AND LOWER(BTRIM(conflict.name)) = LOWER(BTRIM(incoming.project_name))
             )
            THEN incoming.project_name
            ELSE project.name
          END,
          client_name = CASE
            WHEN incoming.update_from_zoho THEN incoming.client_name
            ELSE project.client_name
          END,
          master_job_no = CASE
            WHEN incoming.update_from_zoho
             AND NOT EXISTS (
               SELECT 1
               FROM projects AS conflict
               WHERE conflict.id <> project.id
                 AND conflict.master_job_no = incoming.master_job_no
             )
            THEN NULLIF(incoming.master_job_no, '')
            ELSE project.master_job_no
          END,
          status = CASE
            WHEN incoming.update_from_zoho THEN incoming.project_status
            ELSE project.status
          END,
          updated_at = NOW()
      FROM JSONB_TO_RECORDSET($1::jsonb) AS incoming(
        local_id uuid,
        job_code text,
        project_name text,
        client_name text,
        master_job_no text,
        project_status text,
        update_from_zoho boolean
      )
      WHERE project.id = incoming.local_id
      `,
      [
        JSON.stringify(
          updates.map((update) => ({
            local_id: update.localId,
            job_code: update.jobCode,
            project_name: update.name,
            client_name: update.clientName,
            master_job_no: update.masterJobNo,
            project_status: update.status,
            update_from_zoho: update.updateFromZoho,
          })),
        ),
      ],
    );

    await client.query(
      `
      UPDATE zoho_mappings AS mapping
      SET zoho_entity_id = incoming.zoho_project_id,
          zoho_project_id = incoming.zoho_project_id,
          last_synced_at = NOW(),
          updated_at = NOW()
      FROM JSONB_TO_RECORDSET($1::jsonb) AS incoming(
        local_id uuid,
        zoho_project_id text
      )
      WHERE mapping.entity_type = 'PROJECT'
        AND mapping.local_id = incoming.local_id
      `,
      [
        JSON.stringify(
          updates.map((update) => ({
            local_id: update.localId,
            zoho_project_id: update.zohoProjectId,
          })),
        ),
      ],
    );

    await client.query(
      `
      UPDATE zoho_connections
      SET last_synced_at = NOW(), updated_at = NOW()
      WHERE portal_id = $1
      `,
      [portalId],
    );

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function fetchAndSync(
  zohoProjectId?: string,
): Promise<ZohoProjectSyncResult> {
  const connection = await getZohoConnection();
  if (!connection) throw new Error('Zoho is not connected.');

  const token = await refreshZohoAccessToken(connection.refreshToken);
  if (!token.access_token) throw new Error('Zoho did not return a fresh access token.');

  if (zohoProjectId) {
    const project = await fetchZohoProjectById(
      token.access_token,
      connection.portalId,
      zohoProjectId,
    );

    if (project) return syncFetchedProjects([project], connection.portalId);
  }

  const projects = await fetchAllZohoProjects(token.access_token, connection.portalId);
  const selected = zohoProjectId
    ? projects.filter((project) => String(project.id) === zohoProjectId)
    : projects;

  if (zohoProjectId && selected.length === 0) {
    throw new Error(`Zoho project ${zohoProjectId} was not found in the connected portal.`);
  }

  return syncFetchedProjects(selected, connection.portalId);
}

export async function syncAllZohoProjects(
  maxAgeMs = DEFAULT_SYNC_MAX_AGE_MS,
): Promise<ZohoProjectSyncResult> {
  if (
    syncState.result
    && Date.now() - syncState.completedAt < maxAgeMs
  ) {
    return syncState.result;
  }

  if (syncState.promise) return syncState.promise;

  syncState.promise = fetchAndSync();

  try {
    const result = await syncState.promise;
    syncState.result = result;
    syncState.completedAt = Date.now();
    return result;
  } finally {
    syncState.promise = null;
  }
}

export async function syncZohoProjectById(
  zohoProjectId: string,
): Promise<ZohoProjectSyncResult> {
  return fetchAndSync(zohoProjectId);
}
