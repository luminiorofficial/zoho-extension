import Link from 'next/link';

import type {
  ZohoDepartmentRelationship,
  ZohoMemberProjectRelationship,
  ZohoMemberRelationship,
  ZohoProjectMappingOverview,
  ZohoProjectPageRelationship,
  ZohoProjectRelationship,
  ZohoRelationshipState,
  ZohoTaskRelationship,
} from '@/lib/zoho/relationship-data';

function StateNotice({
  status,
}: Pick<ZohoRelationshipState<unknown>, 'status'>) {
  if (status === 'READY') return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      Project activity is temporarily unavailable.
    </div>
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
          </div>

          <div className="text-right text-xs text-slate-500">
            <p>{project.tasks.length} tasks</p>
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
        <StateNotice status={state.status} />
      </section>
    );
  }

  const member = state.data;

  if (!member) {
    return (
      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Project Activity</h2>
        <p className="mt-2 text-sm text-slate-500">
          No project activity found for this member.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Project Activity</h2>
          <p className="mt-1 text-sm text-slate-500">
            {member.departmentName ?? 'Unassigned department'} · {member.team ?? 'No team'}
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <StatCard label="Projects" value={member.projectCount} />
          <StatCard label="Tasks" value={member.taskCount} />
          <StatCard label="Open" value={member.openTaskCount} />
          <StatCard label="Completed" value={member.closedTaskCount} />
        </div>
      </div>

      <div className="space-y-3 p-5 sm:p-6">
        {member.projects.map((project) => (
          <MemberProjectBlock key={project.zohoProjectId} project={project} />
        ))}

        {member.projects.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No projects or tasks found for this member.
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
        <StatCard label="Tasks" value={project.taskCount} />
        <StatCard label="Open" value={project.openTaskCount} />
        <StatCard label="Completed" value={project.closedTaskCount} />
        <StatCard label="Members" value={project.members.length} />
      </div>

      {project.apiErrors.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Project activity is temporarily unavailable.
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
            No team members found for this project.
          </div>
        )}
      </div>
    </>
  );
}

export function ZohoProjectMembersPanel({
  state,
}: {
  state: ZohoRelationshipState<ZohoProjectPageRelationship>;
}) {
  if (state.status !== 'READY') {
    return <StateNotice status={state.status} />;
  }

  const project = state.data?.project ?? null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Team & Tasks</h2>
      </div>

      <div className="p-5 sm:p-6">
        {project ? (
          <ProjectRelationshipContent project={project} />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
            Project activity is not available yet for this project.
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
    return <StateNotice status={state.status} />;
  }

  const department = state.data;

  if (!department) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        No project activity found for this department.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Project Activity</h2>

        <div className="mt-5 grid gap-3 sm:grid-cols-5">
          <StatCard label="Members" value={department.memberCount} />
          <StatCard label="Projects" value={department.projectCount} />
          <StatCard label="Tasks" value={department.taskCount} />
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
              {member.projects.map((project) => (
                <MemberProjectBlock key={project.zohoProjectId} project={project} />
              ))}

              {member.projects.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                  No projects or tasks found.
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
      </div>
    </section>
  );
}

/* =========================================================
 * NOTE:
 *
 * ZohoProjectMappingOverviewPanel is intentionally not
 * rendered anywhere in the client-facing UI. Project ↔ Zoho
 * mapping status is internal/backend information only.
 *
 * The component and its data source remain in place so the
 * mapping snapshot stays available internally if needed.
 * ======================================================= */

export function ZohoProjectMappingOverviewPanel({
  state,
}: {
  state: ZohoRelationshipState<ZohoProjectMappingOverview>;
}) {
  if (state.status !== 'READY') {
    return <StateNotice status={state.status} />;
  }

  const overview = state.data;
  if (!overview) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-5">
        <h2 className="text-base font-semibold text-slate-900">Zoho project mapping status</h2>

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