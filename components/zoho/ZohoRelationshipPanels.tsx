import Link from 'next/link';

import type {
  ZohoDepartmentRelationship,
  ZohoMemberProjectRelationship,
  ZohoMemberRelationship,
  ZohoProjectMappingOverview,
  ZohoProjectMappingSource,
  ZohoProjectPageRelationship,
  ZohoProjectRelationship,
  ZohoRelationshipState,
  ZohoTaskRelationship,
  ZohoUnresolvedPersonReason,
} from '@/lib/zoho/relationship-data';

function mappingLabel(source: ZohoProjectMappingSource): string {
  if (source === 'PERMANENT') return 'Confirmed mapping';
  if (source === 'MASTER_JOB_NO') return 'Exact master job';
  if (source === 'UNIQUE_PROJECT_CODE') return 'Unique project code';
  return 'Unresolved';
}

function mappingClass(source: ZohoProjectMappingSource): string {
  if (source === 'PERMANENT') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (source === 'MASTER_JOB_NO' || source === 'UNIQUE_PROJECT_CODE') {
    return 'border-amber-200 bg-amber-50 text-amber-700';
  }

  return 'border-red-200 bg-red-50 text-red-700';
}

function unresolvedReasonLabel(reason: ZohoUnresolvedPersonReason): string {
  if (reason === 'INACTIVE_LOCAL_MEMBER') return 'Inactive local member';
  if (reason === 'LEGACY_OR_PLACEHOLDER') return 'Legacy / placeholder Zoho user';
  if (reason === 'MISSING_ZOHO_USER_ID') return 'Missing Zoho user ID';
  return 'Zoho user not mapped to current employee master';
}

function StateNotice({
  status,
  error,
}: Pick<ZohoRelationshipState<unknown>, 'status' | 'error'>) {
  if (status === 'READY') return null;

  return (
    <div
      className={
        status === 'NOT_CONNECTED'
          ? 'rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800'
          : 'rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700'
      }
    >
      <p className="font-semibold">
        {status === 'NOT_CONNECTED' ? 'Zoho not connected' : 'Zoho data unavailable'}
      </p>
      <p className="mt-1">{error ?? 'Could not load Zoho relationship data.'}</p>
      <p className="mt-1 text-xs opacity-80">
        Local CRM data is still available. No Zoho write operation was attempted.
      </p>
    </div>
  );
}

function MappingBadge({ source }: { source: ZohoProjectMappingSource }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${mappingClass(source)}`}
    >
      {mappingLabel(source)}
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function TaskList({ tasks }: { tasks: ZohoTaskRelationship[] }) {
  if (tasks.length === 0) {
    return <p className="py-3 text-sm text-slate-500">No assigned Zoho tasks.</p>;
  }

  return (
    <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {tasks.map((task) => (
        <div key={task.zohoTaskId} className="p-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {task.prefix && (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                    {task.prefix}
                  </span>
                )}
                <p className="font-medium text-slate-900">{task.name || 'Untitled task'}</p>
              </div>

              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                {task.taskList && <span>{task.taskList}</span>}
                {task.priority && <span>Priority: {task.priority}</span>}
                {task.endDate && <span>Due: {task.endDate}</span>}
              </div>
            </div>

            <span
              className={
                task.isClosed
                  ? 'rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700'
                  : 'rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700'
              }
            >
              {task.status}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className={task.isClosed ? 'h-full rounded-full bg-emerald-500' : 'h-full rounded-full bg-blue-500'}
                style={{ width: `${task.completionPercentage}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-600">
              {Math.round(task.completionPercentage)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MemberProjectBlock({ project }: { project: ZohoMemberProjectRelationship }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-slate-50" open={project.openTaskCount > 0}>
      <summary className="cursor-pointer list-none p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {project.localProjectId ? (
                <Link
                  href={`/projects/${project.localProjectId}`}
                  className="font-semibold text-slate-900 hover:text-blue-600"
                >
                  {project.zohoProjectName}
                </Link>
              ) : (
                <p className="font-semibold text-slate-900">{project.zohoProjectName}</p>
              )}
              <MappingBadge source={project.mappingSource} />
              {!project.localProjectId && (
                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                  Zoho-only project
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {project.isZohoProjectUser ? 'Zoho project user' : 'Task owner found in Zoho'}
            </p>
          </div>

          <div className="text-right text-xs text-slate-500">
            <p>{project.tasks.length} assigned tasks</p>
            <p className="mt-1">
              <span className="font-semibold text-blue-700">{project.openTaskCount} open</span>
              {' · '}
              <span className="font-semibold text-emerald-700">{project.closedTaskCount} completed</span>
            </p>
          </div>
        </div>
      </summary>

      <div className="border-t border-slate-200 bg-white p-4">
        <TaskList tasks={project.tasks} />
      </div>
    </details>
  );
}

export function ZohoMemberProjectsPanel({
  state,
}: {
  state: ZohoRelationshipState<ZohoMemberRelationship>;
}) {
  if (state.status !== 'READY') {
    return (
      <section className="mb-8">
        <StateNotice status={state.status} error={state.error} />
      </section>
    );
  }

  const member = state.data;

  if (!member) {
    return (
      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Zoho Projects & Tasks</h2>
        <p className="mt-2 text-sm text-slate-500">
          This local member is not part of the current active employee relationship snapshot.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Zoho Projects & Tasks</h2>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                Read-only live data
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {member.departmentName ?? 'Unassigned department'} · {member.team ?? 'No team'}
            </p>
          </div>

          <p className="text-xs text-slate-400">Source: Zoho Projects task owners</p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <StatCard label="Projects" value={member.projectCount} />
          <StatCard label="Assigned Tasks" value={member.taskCount} />
          <StatCard label="Open" value={member.openTaskCount} />
          <StatCard label="Completed" value={member.closedTaskCount} />
        </div>
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        {!member.zohoUserId && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            This current employee does not have a permanent <code>members.zoho_user_id</code> mapping, so no Zoho work is guessed or attached.
          </div>
        )}

        {member.projects.map((project) => (
          <MemberProjectBlock key={project.zohoProjectId} project={project} />
        ))}

        {member.projects.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No Zoho project membership or assigned Zoho tasks found for this current employee.
          </div>
        )}
      </div>
    </section>
  );
}

function ProjectRelationshipContent({ project }: { project: ZohoProjectRelationship }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Zoho Tasks" value={project.taskCount} />
        <StatCard label="Open" value={project.openTaskCount} />
        <StatCard label="Completed" value={project.closedTaskCount} />
        <StatCard label="Current Members" value={project.members.length} />
      </div>

      {project.apiErrors.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {project.apiErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {project.members.map((member) => (
          <details key={member.localMemberId} className="rounded-xl border border-slate-200" open={member.openTaskCount > 0}>
            <summary className="cursor-pointer list-none p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Link
                    href={`/members/${member.localMemberId}`}
                    className="font-semibold text-slate-900 hover:text-blue-600"
                  >
                    {member.name}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    {member.departmentName ?? 'Unassigned'} · {member.team ?? 'No team'}
                    {!member.isZohoProjectUser && ' · task owner only'}
                  </p>
                </div>

                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-blue-700">{member.openTaskCount} open</span>
                  {' · '}
                  <span className="font-semibold text-emerald-700">{member.closedTaskCount} completed</span>
                </p>
              </div>
            </summary>

            <div className="border-t border-slate-100 bg-slate-50 p-4">
              <TaskList tasks={member.tasks} />
            </div>
          </details>
        ))}

        {project.members.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No current mapped employees were found in this Zoho project.
          </div>
        )}
      </div>

      {(project.unresolvedProjectUsers.length > 0 || project.unresolvedAssignments.length > 0) && (
        <details className="mt-5 rounded-xl border border-red-200 bg-red-50/50">
          <summary className="cursor-pointer list-none p-4 font-semibold text-red-800">
            Unresolved / legacy Zoho people — not attached to current employees
          </summary>

          <div className="space-y-4 border-t border-red-100 p-4 text-sm">
            {project.unresolvedProjectUsers.length > 0 && (
              <div>
                <p className="font-semibold text-slate-800">Project users</p>
                <div className="mt-2 space-y-2">
                  {project.unresolvedProjectUsers.map((person) => (
                    <div
                      key={`${person.zohoUserId ?? person.name}-${person.reason}`}
                      className="rounded-lg border border-red-100 bg-white p-3"
                    >
                      <p className="font-medium text-slate-900">{person.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {unresolvedReasonLabel(person.reason)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {project.unresolvedAssignments.length > 0 && (
              <div>
                <p className="font-semibold text-slate-800">Task assignments</p>
                <div className="mt-2 max-h-80 space-y-2 overflow-auto pr-1">
                  {project.unresolvedAssignments.map((assignment) => (
                    <div
                      key={`${assignment.zohoTaskId}-${assignment.zohoUserId ?? assignment.name}`}
                      className="rounded-lg border border-red-100 bg-white p-3"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <p className="font-medium text-slate-900">{assignment.name}</p>
                        <span className="text-xs text-slate-500">{assignment.taskStatus}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">{assignment.taskName}</p>
                      <p className="mt-1 text-xs text-red-700">
                        {unresolvedReasonLabel(assignment.reason)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      )}
    </>
  );
}

export function ZohoProjectMembersPanel({
  state,
}: {
  state: ZohoRelationshipState<ZohoProjectPageRelationship>;
}) {
  if (state.status !== 'READY') {
    return <StateNotice status={state.status} error={state.error} />;
  }

  const project = state.data?.project ?? null;
  const unresolvedLocalProject = state.data?.unresolvedLocalProject ?? null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Zoho Members & Assigned Tasks</h2>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                Read-only live data
              </span>
              {project && <MappingBadge source={project.mappingSource} />}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Project users and task owners are read from Zoho Projects. Local project_members is not used for this section.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {project ? (
          <ProjectRelationshipContent project={project} />
        ) : (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            <p className="font-semibold">No confirmed Zoho project relationship</p>
            <p className="mt-1">
              {unresolvedLocalProject?.reason ??
                'This local project is not currently mapped to a Zoho project. No fuzzy match was forced.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export function ZohoDepartmentWorkPanel({
  state,
}: {
  state: ZohoRelationshipState<ZohoDepartmentRelationship>;
}) {
  if (state.status !== 'READY') {
    return <StateNotice status={state.status} error={state.error} />;
  }

  const department = state.data;

  if (!department) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        No current Zoho relationship data found for this department.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Department → Members → Zoho Projects → Tasks</h2>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                Read-only live data
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Department and team come from PostgreSQL. Project membership and assigned tasks come from Zoho.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-5">
          <StatCard label="Members" value={department.memberCount} />
          <StatCard label="Zoho Projects" value={department.projectCount} />
          <StatCard label="Assigned Tasks" value={department.taskCount} />
          <StatCard label="Open" value={department.openTaskCount} />
          <StatCard label="Completed" value={department.closedTaskCount} />
        </div>
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        {department.members.map((member) => (
          <details key={member.localMemberId} className="rounded-xl border border-slate-200" open={member.openTaskCount > 0}>
            <summary className="cursor-pointer list-none p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Link
                    href={`/members/${member.localMemberId}`}
                    className="font-semibold text-slate-900 hover:text-blue-600"
                  >
                    {member.name}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    {member.team ?? 'No team'} · {member.projectCount} projects · {member.taskCount} assigned tasks
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-blue-700">{member.openTaskCount} open</span>
                  {' · '}
                  <span className="font-semibold text-emerald-700">{member.closedTaskCount} completed</span>
                </p>
              </div>
            </summary>

            <div className="space-y-3 border-t border-slate-100 bg-slate-50 p-4">
              {!member.zohoUserId && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  No permanent Zoho user mapping. Work is intentionally not guessed.
                </div>
              )}

              {member.projects.map((project) => (
                <MemberProjectBlock key={project.zohoProjectId} project={project} />
              ))}

              {member.projects.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                  No Zoho project membership or assigned tasks found.
                </p>
              )}
            </div>
          </details>
        ))}

        {department.members.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            This active department currently has 0 active employees. The department remains active.
          </div>
        )}

        <p className="text-xs text-slate-400">
          Unmapped, inactive, and legacy Zoho users are never attributed to a department because department ownership comes only from current local employees.
        </p>
      </div>
    </section>
  );
}

export function ZohoProjectMappingOverviewPanel({
  state,
}: {
  state: ZohoRelationshipState<ZohoProjectMappingOverview>;
}) {
  if (state.status !== 'READY') {
    return <StateNotice status={state.status} error={state.error} />;
  }

  const overview = state.data;
  if (!overview) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">Zoho project mapping status</h2>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                Read-only
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Confirmed mappings are used first. Exact master job / unique code matches are only safe runtime fallbacks and are not written automatically.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Local" value={overview.summary.localActiveProjects} />
          <StatCard label="Zoho" value={overview.summary.zohoProjects} />
          <StatCard label="Confirmed Used" value={overview.summary.permanentMappingsUsed} />
          <StatCard
            label="Safe Exact"
            value={overview.summary.exactMasterJobMatches + overview.summary.uniqueCodeMatches}
          />
          <StatCard label="Local Unresolved" value={overview.summary.unresolvedLocalProjects} />
          <StatCard label="Zoho Unresolved" value={overview.summary.unresolvedZohoProjects} />
        </div>
      </div>

      {(overview.unresolvedLocalProjects.length > 0 || overview.unresolvedZohoProjects.length > 0) && (
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <h3 className="font-semibold text-amber-900">Local projects needing manual mapping</h3>
            <div className="mt-3 space-y-2">
              {overview.unresolvedLocalProjects.map((project) => (
                <Link
                  key={project.localProjectId}
                  href={`/projects/${project.localProjectId}`}
                  className="block rounded-lg border border-amber-100 bg-white p-3 hover:border-amber-300"
                >
                  <p className="font-medium text-slate-900">{project.localProjectName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {project.localProjectCode ?? 'No code'} · manual review
                  </p>
                </Link>
              ))}
              {overview.unresolvedLocalProjects.length === 0 && (
                <p className="text-sm text-amber-800">None.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
            <h3 className="font-semibold text-red-900">Zoho-only / unresolved projects</h3>
            <div className="mt-3 space-y-2">
              {overview.unresolvedZohoProjects.map((project) => (
                <div key={project.zohoProjectId} className="rounded-lg border border-red-100 bg-white p-3">
                  <p className="font-medium text-slate-900">{project.zohoProjectName}</p>
                  <p className="mt-1 text-xs text-red-700">Not attached to a local project.</p>
                </div>
              ))}
              {overview.unresolvedZohoProjects.length === 0 && (
                <p className="text-sm text-red-800">None.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}