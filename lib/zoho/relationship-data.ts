import 'server-only';

import type { QueryResultRow } from 'pg';

import { db } from '@/lib/db';
import {
  refreshZohoAccessToken,
  zohoProjectsRequest,
} from '@/lib/zoho/oauth';
import { getZohoConnection } from '@/lib/zoho/token-store';

const PROJECT_FETCH_CONCURRENCY = 6;
const SNAPSHOT_TTL_MS = 20_000;

export type ZohoRelationshipStatus = 'READY' | 'NOT_CONNECTED' | 'ERROR';

export type ZohoProjectMappingSource =
  | 'PERMANENT'
  | 'MASTER_JOB_NO'
  | 'UNIQUE_PROJECT_CODE'
  | 'UNRESOLVED';

export type ZohoUnresolvedPersonReason =
  | 'UNMAPPED_ZOHO_USER'
  | 'INACTIVE_LOCAL_MEMBER'
  | 'LEGACY_OR_PLACEHOLDER'
  | 'MISSING_ZOHO_USER_ID';

interface PageInfo {
  has_next_page?: boolean;
}

interface ZohoObjectResponse {
  [key: string]: unknown;
  page_info?: PageInfo;
}

interface ZohoProject {
  id: string | number;
  name?: string;
  status?: string | { name?: string };
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
}

interface ZohoTaskStatus {
  name?: string;
  is_closed_type?: boolean;
}

interface ZohoTask {
  id: string | number;
  prefix?: string;
  name?: string;
  status?: ZohoTaskStatus;
  priority?: string;
  owners_and_work?: {
    owners?: ZohoUser[];
  };
  assignee?: ZohoUser | ZohoUser[];
  assignees?: ZohoUser[];
  owner?: ZohoUser;
  owners?: ZohoUser[];
  start_date?: string;
  end_date?: string;
  due_date?: string;
  completion_percentage?: number | string;
  is_completed?: boolean;
  tasklist?: {
    name?: string;
  };
}

interface LocalDepartmentRow extends QueryResultRow {
  id: string;
  name: string;
}

interface LocalMemberRow extends QueryResultRow {
  id: string;
  name: string;
  email: string | null;
  role_title: string | null;
  team: string | null;
  zoho_user_id: string | null;
  current_department_id: string | null;
  is_active: boolean;
  department_name: string | null;
}

interface LocalProjectRow extends QueryResultRow {
  id: string;
  code: string | null;
  name: string;
  master_job_no: string | null;
}

interface ProjectMappingRow extends QueryResultRow {
  local_id: string;
  zoho_entity_id: string | null;
  zoho_project_id: string | null;
}

interface ProjectResolution {
  zohoProject: ZohoProject;
  localProject: LocalProjectRow | null;
  mappingSource: ZohoProjectMappingSource;
  mappingNote: string;
}

export interface ZohoRelationshipState<T> {
  status: ZohoRelationshipStatus;
  data: T | null;
  error: string | null;
  fetchedAt: string | null;
}

export interface ZohoMappedPerson {
  zohoUserId: string | null;
  zohoName: string;
  email: string | null;
  localMemberId: string | null;
  localName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  team: string | null;
  isCurrentEmployee: boolean;
  unresolvedReason: ZohoUnresolvedPersonReason | null;
}

export interface ZohoTaskRelationship {
  zohoTaskId: string;
  prefix: string | null;
  name: string;
  status: string;
  isClosed: boolean;
  completionPercentage: number;
  priority: string | null;
  taskList: string | null;
  startDate: string | null;
  endDate: string | null;
  assignees: ZohoMappedPerson[];
}

export interface ZohoProjectMemberRelationship {
  localMemberId: string;
  name: string;
  departmentId: string | null;
  departmentName: string | null;
  team: string | null;
  zohoUserId: string | null;
  isZohoProjectUser: boolean;
  tasks: ZohoTaskRelationship[];
  openTaskCount: number;
  closedTaskCount: number;
}

export interface ZohoUnresolvedProjectUser {
  zohoUserId: string | null;
  name: string;
  email: string | null;
  reason: ZohoUnresolvedPersonReason;
}

export interface ZohoUnresolvedAssignment {
  zohoTaskId: string;
  taskName: string;
  taskStatus: string;
  zohoUserId: string | null;
  name: string;
  email: string | null;
  reason: ZohoUnresolvedPersonReason;
}

export interface ZohoProjectRelationship {
  zohoProjectId: string;
  zohoProjectName: string;
  zohoStatus: string;
  localProjectId: string | null;
  localProjectName: string | null;
  localProjectCode: string | null;
  localMasterJobNo: string | null;
  mappingSource: ZohoProjectMappingSource;
  mappingNote: string;
  taskCount: number;
  openTaskCount: number;
  closedTaskCount: number;
  unassignedTaskCount: number;
  members: ZohoProjectMemberRelationship[];
  unresolvedProjectUsers: ZohoUnresolvedProjectUser[];
  unresolvedAssignments: ZohoUnresolvedAssignment[];
  apiErrors: string[];
}

export interface ZohoMemberProjectRelationship {
  zohoProjectId: string;
  zohoProjectName: string;
  zohoStatus: string;
  localProjectId: string | null;
  localProjectName: string | null;
  mappingSource: ZohoProjectMappingSource;
  mappingNote: string;
  isZohoProjectUser: boolean;
  tasks: ZohoTaskRelationship[];
  openTaskCount: number;
  closedTaskCount: number;
}

export interface ZohoMemberRelationship {
  localMemberId: string;
  name: string;
  email: string | null;
  roleTitle: string | null;
  team: string | null;
  departmentId: string | null;
  departmentName: string | null;
  zohoUserId: string | null;
  projects: ZohoMemberProjectRelationship[];
  projectCount: number;
  taskCount: number;
  openTaskCount: number;
  closedTaskCount: number;
}

export interface ZohoDepartmentRelationship {
  departmentId: string;
  departmentName: string;
  members: ZohoMemberRelationship[];
  memberCount: number;
  projectCount: number;
  taskCount: number;
  openTaskCount: number;
  closedTaskCount: number;
}

export interface ZohoUnresolvedLocalProject {
  localProjectId: string;
  localProjectName: string;
  localProjectCode: string | null;
  masterJobNo: string | null;
  reason: string;
}

export interface ZohoUnresolvedRemoteProject {
  zohoProjectId: string;
  zohoProjectName: string;
  reason: string;
}

export interface ZohoProjectMappingOverview {
  portal: {
    id: string;
    name: string | null;
  };
  summary: {
    localActiveProjects: number;
    zohoProjects: number;
    permanentMappingsUsed: number;
    exactMasterJobMatches: number;
    uniqueCodeMatches: number;
    unresolvedLocalProjects: number;
    unresolvedZohoProjects: number;
  };
  unresolvedLocalProjects: ZohoUnresolvedLocalProject[];
  unresolvedZohoProjects: ZohoUnresolvedRemoteProject[];
}

export interface ZohoRelationshipSnapshot {
  portal: {
    id: string;
    name: string | null;
  };
  summary: {
    localActiveDepartments: number;
    localActiveMembers: number;
    localActiveProjects: number;
    zohoProjects: number;
    permanentMappingsUsed: number;
    exactMasterJobMatches: number;
    uniqueCodeMatches: number;
    unresolvedLocalProjects: number;
    unresolvedZohoProjects: number;
    zohoActivePortalUsers: number;
    mappedPortalUsers: number;
    unmappedPortalUsers: number;
    totalZohoTasks: number;
    openZohoTasks: number;
    closedZohoTasks: number;
    tasksWithoutAssignee: number;
    unresolvedTaskAssignments: number;
  };
  members: ZohoMemberRelationship[];
  departments: ZohoDepartmentRelationship[];
  projects: ZohoProjectRelationship[];
  unresolvedPortalUsers: ZohoMappedPerson[];
  unresolvedLocalProjects: ZohoUnresolvedLocalProject[];
  unresolvedZohoProjects: ZohoUnresolvedRemoteProject[];
}

interface BaseContext {
  portalId: string;
  portalName: string | null;
  accessToken: string;
  departments: LocalDepartmentRow[];
  members: LocalMemberRow[];
  projects: LocalProjectRow[];
  mappings: ProjectMappingRow[];
}

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeProject(value: string | null | undefined): string {
  return normalize(value).replace(/\s*\/\s*/g, '/');
}

function getZohoProjectCode(value: string | null | undefined): string {
  const parts = normalizeProject(value)
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 3) return '';
  return parts.slice(0, 3).join('/');
}

function getZohoUserId(user: ZohoUser): string {
  return String(user.zpuid ?? user.id ?? user.zuid ?? '').trim();
}

function getZohoUserName(user: ZohoUser): string {
  if (user.full_name?.trim()) return user.full_name.trim();

  const fullName = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (fullName) return fullName;
  return user.name?.trim() ?? '';
}

function getProjectStatus(project: ZohoProject): string {
  if (typeof project.status === 'string') return project.status;
  return project.status?.name ?? '';
}

function getTaskAssignees(task: ZohoTask): ZohoUser[] {
  if (Array.isArray(task.owners_and_work?.owners)) {
    return task.owners_and_work?.owners ?? [];
  }

  if (Array.isArray(task.assignees)) return task.assignees;
  if (Array.isArray(task.assignee)) return task.assignee;
  if (task.assignee) return [task.assignee];
  if (Array.isArray(task.owners)) return task.owners;
  if (task.owner) return [task.owner];
  return [];
}

function getTaskClosed(task: ZohoTask): boolean {
  if (task.is_completed === true) return true;
  if (task.status?.is_closed_type === true) return true;

  const status = normalize(task.status?.name);
  return status === 'CLOSED' || status === 'COMPLETED' || status === 'DONE';
}

function getTaskCompletion(task: ZohoTask, isClosed: boolean): number {
  const parsed = Number(task.completion_percentage);
  if (Number.isFinite(parsed)) return Math.min(100, Math.max(0, parsed));
  return isClosed ? 100 : 0;
}

async function fetchAllV3<T>(
  accessToken: string,
  path: string,
  responseKey: string,
): Promise<T[]> {
  const records: T[] = [];
  let page = 1;

  while (true) {
    const separator = path.includes('?') ? '&' : '?';
    const payload = await zohoProjectsRequest<T[] | ZohoObjectResponse>(
      accessToken,
      `${path}${separator}page=${page}&per_page=100`,
    );

    if (Array.isArray(payload)) {
      records.push(...payload);
      break;
    }

    const rows = payload[responseKey];
    if (Array.isArray(rows)) records.push(...(rows as T[]));

    if (!payload.page_info?.has_next_page) break;

    page += 1;
    if (page > 100) {
      throw new Error(`Zoho pagination safety limit reached for ${path}.`);
    }
  }

  return records;
}

async function fetchPortalUsers(
  accessToken: string,
  portalId: string,
): Promise<ZohoUser[]> {
  const payload = await zohoProjectsRequest<
    ZohoUser[] | { users?: ZohoUser[] }
  >(
    accessToken,
    `/restapi/portal/${portalId}/users/?user_type=active`,
  );

  return Array.isArray(payload) ? payload : payload.users ?? [];
}

async function fetchProjectUsers(
  accessToken: string,
  portalId: string,
  projectId: string,
): Promise<ZohoUser[]> {
  const payload = await zohoProjectsRequest<
    ZohoUser[] | { users?: ZohoUser[] }
  >(
    accessToken,
    `/restapi/portal/${portalId}/projects/${projectId}/users/?user_type=active`,
  );

  return Array.isArray(payload) ? payload : payload.users ?? [];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const index = cursor;
      cursor += 1;

      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

async function loadBaseContext(): Promise<BaseContext> {
  const connection = await getZohoConnection();

  if (!connection) {
    throw new Error('ZOHO_NOT_CONNECTED');
  }

  const tokenResponse = await refreshZohoAccessToken(connection.refreshToken);
  const accessToken = tokenResponse.access_token;

  if (!accessToken) {
    throw new Error('Zoho did not return a fresh access token.');
  }

  const [departmentResult, memberResult, projectResult, mappingResult] =
    await Promise.all([
      db.query<LocalDepartmentRow>(
        `
        SELECT id, name
        FROM departments
        WHERE is_active = TRUE
        ORDER BY name
        `,
      ),
      db.query<LocalMemberRow>(
        `
        SELECT
          m.id,
          m.name,
          m.email,
          m.role_title,
          m.team,
          m.zoho_user_id,
          m.current_department_id,
          m.is_active,
          d.name AS department_name
        FROM members m
        LEFT JOIN departments d
          ON d.id = m.current_department_id
        ORDER BY d.name NULLS LAST, m.name
        `,
      ),
      db.query<LocalProjectRow>(
        `
        SELECT id, code, name, master_job_no
        FROM projects
        WHERE is_active = TRUE
        ORDER BY name
        `,
      ),
      db.query<ProjectMappingRow>(
        `
        SELECT local_id, zoho_entity_id, zoho_project_id
        FROM zoho_mappings
        WHERE entity_type = 'PROJECT'
        `,
      ),
    ]);

  return {
    portalId: connection.portalId,
    portalName: connection.portalName,
    accessToken,
    departments: departmentResult.rows,
    members: memberResult.rows,
    projects: projectResult.rows,
    mappings: mappingResult.rows,
  };
}

function getEffectiveMappedZohoProjectId(mapping: ProjectMappingRow): string {
  return String(mapping.zoho_entity_id ?? mapping.zoho_project_id ?? '').trim();
}

function resolveProjects(
  zohoProjects: ZohoProject[],
  localProjects: LocalProjectRow[],
  mappings: ProjectMappingRow[],
): {
  resolutions: ProjectResolution[];
  unresolvedLocalProjects: ZohoUnresolvedLocalProject[];
  unresolvedZohoProjects: ZohoUnresolvedRemoteProject[];
} {
  const localById = new Map(localProjects.map((project) => [project.id, project]));
  const permanentByZohoId = new Map<string, ProjectMappingRow>();
  const permanentByLocalId = new Map<string, ProjectMappingRow>();

  for (const mapping of mappings) {
    const zohoProjectId = getEffectiveMappedZohoProjectId(mapping);
    permanentByLocalId.set(mapping.local_id, mapping);
    if (zohoProjectId) permanentByZohoId.set(zohoProjectId, mapping);
  }

  const zohoCodeCounts = new Map<string, number>();
  for (const project of zohoProjects) {
    const code = getZohoProjectCode(project.name);
    if (code) zohoCodeCounts.set(code, (zohoCodeCounts.get(code) ?? 0) + 1);
  }

  const localCodeCounts = new Map<string, number>();
  for (const project of localProjects) {
    const code = normalizeProject(project.code);
    if (code) localCodeCounts.set(code, (localCodeCounts.get(code) ?? 0) + 1);
  }

  const usedLocalIds = new Set<string>();

  const resolutions = zohoProjects.map<ProjectResolution>((zohoProject) => {
    const zohoProjectId = String(zohoProject.id);
    const permanentMapping = permanentByZohoId.get(zohoProjectId);

    if (permanentMapping) {
      const localProject = localById.get(permanentMapping.local_id) ?? null;

      if (localProject) {
        usedLocalIds.add(localProject.id);
        return {
          zohoProject,
          localProject,
          mappingSource: 'PERMANENT',
          mappingNote: 'Confirmed zoho_mappings record.',
        };
      }

      return {
        zohoProject,
        localProject: null,
        mappingSource: 'UNRESOLVED',
        mappingNote: 'Permanent mapping points to a local project that is not active/present.',
      };
    }

    const zohoName = normalizeProject(zohoProject.name);

    const masterMatches = localProjects.filter(
      (project) =>
        !permanentByLocalId.has(project.id) &&
        Boolean(project.master_job_no) &&
        normalizeProject(project.master_job_no) === zohoName,
    );

    if (masterMatches.length === 1) {
      const localProject = masterMatches[0];
      usedLocalIds.add(localProject.id);
      return {
        zohoProject,
        localProject,
        mappingSource: 'MASTER_JOB_NO',
        mappingNote: 'Exact master_job_no match. Not persisted automatically.',
      };
    }

    const code = getZohoProjectCode(zohoProject.name);

    if (
      code &&
      zohoCodeCounts.get(code) === 1 &&
      localCodeCounts.get(code) === 1
    ) {
      const localProject =
        localProjects.find(
          (project) =>
            !permanentByLocalId.has(project.id) &&
            normalizeProject(project.code) === code,
        ) ?? null;

      if (localProject) {
        usedLocalIds.add(localProject.id);
        return {
          zohoProject,
          localProject,
          mappingSource: 'UNIQUE_PROJECT_CODE',
          mappingNote: 'Exact unique project code match. Not persisted automatically.',
        };
      }
    }

    return {
      zohoProject,
      localProject: null,
      mappingSource: 'UNRESOLVED',
      mappingNote: 'No confirmed mapping, exact master_job_no, or unique exact project code match.',
    };
  });

  const zohoIds = new Set(zohoProjects.map((project) => String(project.id)));

  const unresolvedLocalProjects = localProjects
    .filter((project) => !usedLocalIds.has(project.id))
    .map<ZohoUnresolvedLocalProject>((project) => {
      const mapping = permanentByLocalId.get(project.id);
      const mappedZohoId = mapping ? getEffectiveMappedZohoProjectId(mapping) : '';

      return {
        localProjectId: project.id,
        localProjectName: project.name,
        localProjectCode: project.code,
        masterJobNo: project.master_job_no,
        reason:
          mappedZohoId && !zohoIds.has(mappedZohoId)
            ? `Confirmed mapping points to Zoho project ${mappedZohoId}, but that project was not returned by Zoho.`
            : 'No confirmed/safe exact Zoho project match. Manual review required.',
      };
    });

  const unresolvedZohoProjects = resolutions
    .filter((resolution) => !resolution.localProject)
    .map<ZohoUnresolvedRemoteProject>((resolution) => ({
      zohoProjectId: String(resolution.zohoProject.id),
      zohoProjectName: resolution.zohoProject.name ?? '',
      reason: resolution.mappingNote,
    }));

  return {
    resolutions,
    unresolvedLocalProjects,
    unresolvedZohoProjects,
  };
}

function createPersonMapper(members: LocalMemberRow[]) {
  const activeByZohoId = new Map<string, LocalMemberRow>();
  const inactiveByZohoId = new Map<string, LocalMemberRow>();

  for (const member of members) {
    if (!member.zoho_user_id) continue;

    if (member.is_active) activeByZohoId.set(member.zoho_user_id, member);
    else inactiveByZohoId.set(member.zoho_user_id, member);
  }

  function mapPerson(user: ZohoUser): ZohoMappedPerson {
    const zohoUserId = getZohoUserId(user) || null;
    const zohoName = getZohoUserName(user);
    const normalizedName = normalize(zohoName);

    if (zohoUserId) {
      const activeMember = activeByZohoId.get(zohoUserId);

      if (activeMember) {
        return {
          zohoUserId,
          zohoName,
          email: user.email ?? activeMember.email,
          localMemberId: activeMember.id,
          localName: activeMember.name,
          departmentId: activeMember.current_department_id,
          departmentName: activeMember.department_name,
          team: activeMember.team,
          isCurrentEmployee: true,
          unresolvedReason: null,
        };
      }

      const inactiveMember = inactiveByZohoId.get(zohoUserId);

      if (inactiveMember) {
        return {
          zohoUserId,
          zohoName,
          email: user.email ?? inactiveMember.email,
          localMemberId: null,
          localName: inactiveMember.name,
          departmentId: null,
          departmentName: null,
          team: inactiveMember.team,
          isCurrentEmployee: false,
          unresolvedReason: 'INACTIVE_LOCAL_MEMBER',
        };
      }
    }

    const isPlaceholder =
      normalizedName.includes('UNASSIGNED USER') ||
      normalizedName === 'UNASSIGNED' ||
      normalizedName.includes('PLACEHOLDER');

    return {
      zohoUserId,
      zohoName,
      email: user.email ?? null,
      localMemberId: null,
      localName: null,
      departmentId: null,
      departmentName: null,
      team: null,
      isCurrentEmployee: false,
      unresolvedReason: isPlaceholder
        ? 'LEGACY_OR_PLACEHOLDER'
        : zohoUserId
          ? 'UNMAPPED_ZOHO_USER'
          : 'MISSING_ZOHO_USER_ID',
    };
  }

  return {
    mapPerson,
    activeByZohoId,
  };
}

function uniqueUnresolvedProjectUsers(
  people: ZohoUnresolvedProjectUser[],
): ZohoUnresolvedProjectUser[] {
  const unique = new Map<string, ZohoUnresolvedProjectUser>();

  for (const person of people) {
    const key = person.zohoUserId ?? `${person.name}|${person.email ?? ''}|${person.reason}`;
    if (!unique.has(key)) unique.set(key, person);
  }

  return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function sortTasks(tasks: ZohoTaskRelationship[]): ZohoTaskRelationship[] {
  return [...tasks].sort((a, b) => {
    if (a.isClosed !== b.isClosed) return a.isClosed ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}

async function buildProjectRelationship(
  resolution: ProjectResolution,
  context: BaseContext,
  mapPerson: (user: ZohoUser) => ZohoMappedPerson,
): Promise<ZohoProjectRelationship> {
  const zohoProjectId = String(resolution.zohoProject.id);
  const apiErrors: string[] = [];

  const [usersResult, tasksResult] = await Promise.allSettled([
    fetchProjectUsers(context.accessToken, context.portalId, zohoProjectId),
    fetchAllV3<ZohoTask>(
      context.accessToken,
      `/api/v3/portal/${context.portalId}/projects/${zohoProjectId}/tasks`,
      'tasks',
    ),
  ]);

  const projectUsers =
    usersResult.status === 'fulfilled'
      ? usersResult.value
      : [];

  if (usersResult.status === 'rejected') {
    apiErrors.push(
      usersResult.reason instanceof Error
        ? `Project users: ${usersResult.reason.message}`
        : 'Project users could not be loaded.',
    );
  }

  const tasks =
    tasksResult.status === 'fulfilled'
      ? tasksResult.value
      : [];

  if (tasksResult.status === 'rejected') {
    apiErrors.push(
      tasksResult.reason instanceof Error
        ? `Tasks: ${tasksResult.reason.message}`
        : 'Tasks could not be loaded.',
    );
  }

  const memberMap = new Map<string, ZohoProjectMemberRelationship>();
  const unresolvedProjectUsers: ZohoUnresolvedProjectUser[] = [];

  for (const user of projectUsers) {
    const person = mapPerson(user);

    if (person.localMemberId) {
      memberMap.set(person.localMemberId, {
        localMemberId: person.localMemberId,
        name: person.localName ?? person.zohoName,
        departmentId: person.departmentId,
        departmentName: person.departmentName,
        team: person.team,
        zohoUserId: person.zohoUserId,
        isZohoProjectUser: true,
        tasks: [],
        openTaskCount: 0,
        closedTaskCount: 0,
      });
    } else if (person.unresolvedReason) {
      unresolvedProjectUsers.push({
        zohoUserId: person.zohoUserId,
        name: person.zohoName || person.localName || 'Unknown Zoho user',
        email: person.email,
        reason: person.unresolvedReason,
      });
    }
  }

  const taskRelationships: ZohoTaskRelationship[] = [];
  const unresolvedAssignments: ZohoUnresolvedAssignment[] = [];
  let openTaskCount = 0;
  let closedTaskCount = 0;
  let unassignedTaskCount = 0;

  for (const task of tasks) {
    const isClosed = getTaskClosed(task);
    if (isClosed) closedTaskCount += 1;
    else openTaskCount += 1;

    const rawAssignees = getTaskAssignees(task);
    if (rawAssignees.length === 0) unassignedTaskCount += 1;

    const assignees = rawAssignees.map(mapPerson);
    const taskRelationship: ZohoTaskRelationship = {
      zohoTaskId: String(task.id),
      prefix: task.prefix ?? null,
      name: task.name ?? '',
      status: task.status?.name ?? (isClosed ? 'Completed' : 'Open'),
      isClosed,
      completionPercentage: getTaskCompletion(task, isClosed),
      priority: task.priority ?? null,
      taskList: task.tasklist?.name ?? null,
      startDate: task.start_date ?? null,
      endDate: task.end_date ?? task.due_date ?? null,
      assignees,
    };

    taskRelationships.push(taskRelationship);

    for (const person of assignees) {
      if (person.localMemberId) {
        let member = memberMap.get(person.localMemberId);

        if (!member) {
          member = {
            localMemberId: person.localMemberId,
            name: person.localName ?? person.zohoName,
            departmentId: person.departmentId,
            departmentName: person.departmentName,
            team: person.team,
            zohoUserId: person.zohoUserId,
            isZohoProjectUser: false,
            tasks: [],
            openTaskCount: 0,
            closedTaskCount: 0,
          };
          memberMap.set(person.localMemberId, member);
        }

        if (!member.tasks.some((item) => item.zohoTaskId === taskRelationship.zohoTaskId)) {
          member.tasks.push(taskRelationship);
          if (isClosed) member.closedTaskCount += 1;
          else member.openTaskCount += 1;
        }
      } else if (person.unresolvedReason) {
        unresolvedAssignments.push({
          zohoTaskId: taskRelationship.zohoTaskId,
          taskName: taskRelationship.name,
          taskStatus: taskRelationship.status,
          zohoUserId: person.zohoUserId,
          name: person.zohoName || person.localName || 'Unknown Zoho user',
          email: person.email,
          reason: person.unresolvedReason,
        });
      }
    }
  }

  const members = Array.from(memberMap.values())
    .map((member) => ({
      ...member,
      tasks: sortTasks(member.tasks),
    }))
    .sort((a, b) => {
      const taskDifference = b.tasks.length - a.tasks.length;
      return taskDifference !== 0 ? taskDifference : a.name.localeCompare(b.name);
    });

  return {
    zohoProjectId,
    zohoProjectName: resolution.zohoProject.name ?? '',
    zohoStatus: getProjectStatus(resolution.zohoProject),
    localProjectId: resolution.localProject?.id ?? null,
    localProjectName: resolution.localProject?.name ?? null,
    localProjectCode: resolution.localProject?.code ?? null,
    localMasterJobNo: resolution.localProject?.master_job_no ?? null,
    mappingSource: resolution.mappingSource,
    mappingNote: resolution.mappingNote,
    taskCount: taskRelationships.length,
    openTaskCount,
    closedTaskCount,
    unassignedTaskCount,
    members,
    unresolvedProjectUsers: uniqueUnresolvedProjectUsers(unresolvedProjectUsers),
    unresolvedAssignments,
    apiErrors,
  };
}

function buildMemberRelationships(
  activeMembers: LocalMemberRow[],
  projects: ZohoProjectRelationship[],
): ZohoMemberRelationship[] {
  return activeMembers
    .map<ZohoMemberRelationship>((member) => {
      const memberProjects = projects
        .flatMap<ZohoMemberProjectRelationship>((project) => {
          const projectMember = project.members.find(
            (candidate) => candidate.localMemberId === member.id,
          );

          if (!projectMember) return [];

          return [{
            zohoProjectId: project.zohoProjectId,
            zohoProjectName: project.zohoProjectName,
            zohoStatus: project.zohoStatus,
            localProjectId: project.localProjectId,
            localProjectName: project.localProjectName,
            mappingSource: project.mappingSource,
            mappingNote: project.mappingNote,
            isZohoProjectUser: projectMember.isZohoProjectUser,
            tasks: projectMember.tasks,
            openTaskCount: projectMember.openTaskCount,
            closedTaskCount: projectMember.closedTaskCount,
          }];
        })
        .sort((a, b) => {
          const openDifference = b.openTaskCount - a.openTaskCount;
          if (openDifference !== 0) return openDifference;
          return a.zohoProjectName.localeCompare(b.zohoProjectName);
        });

      const taskCount = memberProjects.reduce(
        (total, project) => total + project.tasks.length,
        0,
      );

      const openTaskCount = memberProjects.reduce(
        (total, project) => total + project.openTaskCount,
        0,
      );

      const closedTaskCount = memberProjects.reduce(
        (total, project) => total + project.closedTaskCount,
        0,
      );

      return {
        localMemberId: member.id,
        name: member.name,
        email: member.email,
        roleTitle: member.role_title,
        team: member.team,
        departmentId: member.current_department_id,
        departmentName: member.department_name,
        zohoUserId: member.zoho_user_id,
        projects: memberProjects,
        projectCount: memberProjects.length,
        taskCount,
        openTaskCount,
        closedTaskCount,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function buildDepartmentRelationships(
  departments: LocalDepartmentRow[],
  members: ZohoMemberRelationship[],
): ZohoDepartmentRelationship[] {
  return departments.map<ZohoDepartmentRelationship>((department) => {
    const departmentMembers = members.filter(
      (member) => member.departmentId === department.id,
    );

    const projectIds = new Set<string>();
    let taskCount = 0;
    let openTaskCount = 0;
    let closedTaskCount = 0;

    for (const member of departmentMembers) {
      taskCount += member.taskCount;
      openTaskCount += member.openTaskCount;
      closedTaskCount += member.closedTaskCount;
      for (const project of member.projects) projectIds.add(project.zohoProjectId);
    }

    return {
      departmentId: department.id,
      departmentName: department.name,
      members: departmentMembers,
      memberCount: departmentMembers.length,
      projectCount: projectIds.size,
      taskCount,
      openTaskCount,
      closedTaskCount,
    };
  });
}

function buildMappingOverviewFromResolved(
  context: BaseContext,
  resolutions: ProjectResolution[],
  unresolvedLocalProjects: ZohoUnresolvedLocalProject[],
  unresolvedZohoProjects: ZohoUnresolvedRemoteProject[],
): ZohoProjectMappingOverview {
  return {
    portal: {
      id: context.portalId,
      name: context.portalName,
    },
    summary: {
      localActiveProjects: context.projects.length,
      zohoProjects: resolutions.length,
      permanentMappingsUsed: resolutions.filter(
        (resolution) => resolution.mappingSource === 'PERMANENT',
      ).length,
      exactMasterJobMatches: resolutions.filter(
        (resolution) => resolution.mappingSource === 'MASTER_JOB_NO',
      ).length,
      uniqueCodeMatches: resolutions.filter(
        (resolution) => resolution.mappingSource === 'UNIQUE_PROJECT_CODE',
      ).length,
      unresolvedLocalProjects: unresolvedLocalProjects.length,
      unresolvedZohoProjects: unresolvedZohoProjects.length,
    },
    unresolvedLocalProjects,
    unresolvedZohoProjects,
  };
}

async function buildSnapshot(): Promise<ZohoRelationshipSnapshot> {
  const context = await loadBaseContext();

  const [portalUsersResult, zohoProjects] = await Promise.all([
    fetchPortalUsers(context.accessToken, context.portalId).catch(() => [] as ZohoUser[]),
    fetchAllV3<ZohoProject>(
      context.accessToken,
      `/api/v3/portal/${context.portalId}/projects`,
      'projects',
    ),
  ]);

  const {
    resolutions,
    unresolvedLocalProjects,
    unresolvedZohoProjects,
  } = resolveProjects(zohoProjects, context.projects, context.mappings);

  const { mapPerson, activeByZohoId } = createPersonMapper(context.members);

  const projects = await mapWithConcurrency(
    resolutions,
    PROJECT_FETCH_CONCURRENCY,
    (resolution) => buildProjectRelationship(resolution, context, mapPerson),
  );

  const activeMembers = context.members.filter((member) => member.is_active);
  const members = buildMemberRelationships(activeMembers, projects);
  const departments = buildDepartmentRelationships(context.departments, members);

  const unresolvedPortalUsers = portalUsersResult
    .map(mapPerson)
    .filter((person) => !person.isCurrentEmployee);

  const totalZohoTasks = projects.reduce((total, project) => total + project.taskCount, 0);
  const openZohoTasks = projects.reduce((total, project) => total + project.openTaskCount, 0);
  const closedZohoTasks = projects.reduce((total, project) => total + project.closedTaskCount, 0);
  const tasksWithoutAssignee = projects.reduce(
    (total, project) => total + project.unassignedTaskCount,
    0,
  );
  const unresolvedTaskAssignments = projects.reduce(
    (total, project) => total + project.unresolvedAssignments.length,
    0,
  );

  return {
    portal: {
      id: context.portalId,
      name: context.portalName,
    },
    summary: {
      localActiveDepartments: context.departments.length,
      localActiveMembers: activeMembers.length,
      localActiveProjects: context.projects.length,
      zohoProjects: zohoProjects.length,
      permanentMappingsUsed: resolutions.filter(
        (resolution) => resolution.mappingSource === 'PERMANENT',
      ).length,
      exactMasterJobMatches: resolutions.filter(
        (resolution) => resolution.mappingSource === 'MASTER_JOB_NO',
      ).length,
      uniqueCodeMatches: resolutions.filter(
        (resolution) => resolution.mappingSource === 'UNIQUE_PROJECT_CODE',
      ).length,
      unresolvedLocalProjects: unresolvedLocalProjects.length,
      unresolvedZohoProjects: unresolvedZohoProjects.length,
      zohoActivePortalUsers: portalUsersResult.length,
      mappedPortalUsers: portalUsersResult.filter((user) => {
        const id = getZohoUserId(user);
        return Boolean(id && activeByZohoId.has(id));
      }).length,
      unmappedPortalUsers: unresolvedPortalUsers.length,
      totalZohoTasks,
      openZohoTasks,
      closedZohoTasks,
      tasksWithoutAssignee,
      unresolvedTaskAssignments,
    },
    members,
    departments,
    projects,
    unresolvedPortalUsers,
    unresolvedLocalProjects,
    unresolvedZohoProjects,
  };
}

let snapshotCache:
  | {
      expiresAt: number;
      promise: Promise<ZohoRelationshipSnapshot>;
    }
  | null = null;

async function getCachedSnapshot(): Promise<ZohoRelationshipSnapshot> {
  const now = Date.now();

  if (snapshotCache && snapshotCache.expiresAt > now) {
    return snapshotCache.promise;
  }

  const promise = buildSnapshot();
  snapshotCache = {
    expiresAt: now + SNAPSHOT_TTL_MS,
    promise,
  };

  try {
    return await promise;
  } catch (error) {
    if (snapshotCache?.promise === promise) snapshotCache = null;
    throw error;
  }
}

function stateFromError<T>(error: unknown): ZohoRelationshipState<T> {
  const message = error instanceof Error ? error.message : 'Zoho relationship data could not be loaded.';

  if (message === 'ZOHO_NOT_CONNECTED') {
    return {
      status: 'NOT_CONNECTED',
      data: null,
      error: 'Zoho is not connected.',
      fetchedAt: null,
    };
  }

  return {
    status: 'ERROR',
    data: null,
    error: message,
    fetchedAt: null,
  };
}

export async function getZohoRelationshipSnapshotState(): Promise<
  ZohoRelationshipState<ZohoRelationshipSnapshot>
> {
  try {
    const data = await getCachedSnapshot();
    return {
      status: 'READY',
      data,
      error: null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    return stateFromError(error);
  }
}

export async function getZohoMemberRelationshipState(
  localMemberId: string,
): Promise<ZohoRelationshipState<ZohoMemberRelationship>> {
  try {
    const snapshot = await getCachedSnapshot();
    return {
      status: 'READY',
      data: snapshot.members.find((member) => member.localMemberId === localMemberId) ?? null,
      error: null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    return stateFromError(error);
  }
}

export async function getZohoDepartmentRelationshipState(
  departmentId: string,
): Promise<ZohoRelationshipState<ZohoDepartmentRelationship>> {
  try {
    const snapshot = await getCachedSnapshot();
    return {
      status: 'READY',
      data:
        snapshot.departments.find(
          (department) => department.departmentId === departmentId,
        ) ?? null,
      error: null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    return stateFromError(error);
  }
}

export interface ZohoProjectPageRelationship {
  project: ZohoProjectRelationship | null;
  unresolvedLocalProject: ZohoUnresolvedLocalProject | null;
}

export async function getZohoProjectRelationshipState(
  localProjectId: string,
): Promise<ZohoRelationshipState<ZohoProjectPageRelationship>> {
  try {
    const snapshot = await getCachedSnapshot();
    return {
      status: 'READY',
      data: {
        project:
          snapshot.projects.find(
            (project) => project.localProjectId === localProjectId,
          ) ?? null,
        unresolvedLocalProject:
          snapshot.unresolvedLocalProjects.find(
            (project) => project.localProjectId === localProjectId,
          ) ?? null,
      },
      error: null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    return stateFromError(error);
  }
}

export async function getZohoProjectMappingOverviewState(): Promise<
  ZohoRelationshipState<ZohoProjectMappingOverview>
> {
  try {
    const context = await loadBaseContext();
    const zohoProjects = await fetchAllV3<ZohoProject>(
      context.accessToken,
      `/api/v3/portal/${context.portalId}/projects`,
      'projects',
    );

    const {
      resolutions,
      unresolvedLocalProjects,
      unresolvedZohoProjects,
    } = resolveProjects(zohoProjects, context.projects, context.mappings);

    return {
      status: 'READY',
      data: buildMappingOverviewFromResolved(
        context,
        resolutions,
        unresolvedLocalProjects,
        unresolvedZohoProjects,
      ),
      error: null,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    return stateFromError(error);
  }
}