'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Pencil,
  Users,
  X,
} from 'lucide-react';

import ProgressBar from '@/components/common/ProgressBar';
import StatusBadge from '@/components/common/StatusBadge';
import CapacityBadge from '@/components/workload/CapacityBadge';

import {
  getCapacityStatus,
  isActiveProjectStatus,
  MAX_ACTIVE_PROJECTS,
} from '@/lib/capacity';

import { PROJECT_STATUS_VALUES } from '@/lib/project-constants';

import {
  PROJECT_STATUSES,
  type MemberWorkload,
  type ProjectDetail,
} from '@/types';

interface ProjectDepartmentOption {
  id: string;
  name: string;

  goals: {
    id: string;
    title: string;
    code?: string;
  }[];
}

interface ProjectDetailClientProps {
  project: ProjectDetail;

  /*
   * Despite the historical prop name, this now contains
   * ALL active company members, not only department members.
   */
  departmentMembers: MemberWorkload[];

  departments: ProjectDepartmentOption[];
}

const fieldClass =
  'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

function formatDate(value?: string): string {
  if (!value) return '—';

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatBudget(value?: number): string {
  if (value === undefined) return '—';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}

export default function ProjectDetailClient({
  project,
  departmentMembers,
  departments,
}: ProjectDetailClientProps) {
  const router = useRouter();

  const [editing, setEditing] = useState(false);

  const [departmentId, setDepartmentId] = useState(project.departmentId);
  const [goalId, setGoalId] = useState(project.goalId);

  const [clientName, setClientName] = useState(
    project.clientName ?? '',
  );

  const [name, setName] = useState(project.name);

  const [jobCode, setJobCode] = useState(
    project.jobCode ?? '',
  );

  const [description, setDescription] = useState(
    project.description ?? '',
  );

  const [ownerId, setOwnerId] = useState(
    project.ownerId ??
      departmentMembers[0]?.memberId ??
      '',
  );

  const [memberIds, setMemberIds] = useState<string[]>(
    [...new Set(project.memberIds)],
  );

  const [startDate, setStartDate] = useState(
    project.startDate ?? '',
  );

  const [deadline, setDeadline] = useState(
    project.deadline ?? '',
  );

  const [status, setStatus] = useState(project.status);

  const [budget, setBudget] = useState(
    String(project.budget ?? 0),
  );

  const [pending, setPending] = useState(false);

  const [pendingClosureId, setPendingClosureId] =
    useState('');

  const [error, setError] = useState('');

  const selectedDepartment =
    departments.find(
      (department) =>
        department.id === departmentId,
    ) ?? departments[0];

  const selectedGoalId =
    selectedDepartment?.goals.some(
      (goal) => goal.id === goalId,
    )
      ? goalId
      : selectedDepartment?.goals[0]?.id ?? '';

  const selectedMemberIds = new Set(
    [ownerId, ...memberIds].filter(Boolean),
  );

  const completedClosure =
    project.closureItems.filter(
      (item) => item.completed,
    ).length;

  const allClosureComplete =
    project.closureItems.every(
      (item) =>
        !item.required || item.completed,
    );

  function projectedCapacity(
    member: MemberWorkload,
  ) {
    const wasCounted =
      project.memberIds.includes(member.memberId) &&
      isActiveProjectStatus(project.status);

    const willBeCounted =
      selectedMemberIds.has(member.memberId) &&
      isActiveProjectStatus(status);

    const activeProjectCount = Math.max(
      0,
      member.activeProjectCount +
        (willBeCounted ? 1 : 0) -
        (wasCounted ? 1 : 0),
    );

    return {
      activeProjectCount,

      status: getCapacityStatus({
        ...member,
        activeProjectCount,
      }),
    };
  }

  const assignmentWarnings =
    departmentMembers.flatMap((member) => {
      if (
        !selectedMemberIds.has(
          member.memberId,
        )
      ) {
        return [];
      }

      const wasCounted =
        project.memberIds.includes(
          member.memberId,
        ) &&
        isActiveProjectStatus(
          project.status,
        );

      const willBeCounted =
        isActiveProjectStatus(status);

      const addsAssignment =
        !project.memberIds.includes(
          member.memberId,
        ) ||
        (!wasCounted && willBeCounted);

      if (!addsAssignment) {
        return [];
      }

      const projected =
        projectedCapacity(member);

      const warnings: string[] = [];

      if (
        projected.activeProjectCount >
        MAX_ACTIVE_PROJECTS
      ) {
        warnings.push(
          `${member.memberName} would have ${projected.activeProjectCount} active projects, above the recommended maximum of ${MAX_ACTIVE_PROJECTS}.`,
        );
      }

      if (
        member.capacityStatus ===
          'Overloaded' ||
        projected.status === 'Overloaded'
      ) {
        warnings.push(
          `${member.memberName} is ${projected.status.toLowerCase()} based on current and projected workload.`,
        );
      }

      return warnings;
    });

  function toggleMember(
    memberId: string,
  ) {
    if (memberId === ownerId) {
      return;
    }

    setMemberIds((current) =>
      current.includes(memberId)
        ? current.filter(
            (id) => id !== memberId,
          )
        : [...current, memberId],
    );
  }

  function changeOwner(
    nextOwnerId: string,
  ) {
    setOwnerId(nextOwnerId);

    setMemberIds((current) => [
      ...new Set([
        ...current,
        nextOwnerId,
      ]),
    ]);
  }

  function changeDepartment(
    nextDepartmentId: string,
  ) {
    setDepartmentId(
      nextDepartmentId,
    );

    const nextDepartment =
      departments.find(
        (department) =>
          department.id ===
          nextDepartmentId,
      );

    setGoalId(
      nextDepartment?.goals[0]?.id ??
        '',
    );
  }

  async function saveProject(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedGoalId) {
      setError(
        'Select a valid Key / Goal.',
      );
      return;
    }

    if (!ownerId) {
      setError(
        'Select a project owner.',
      );
      return;
    }

    if (
      assignmentWarnings.length &&
      !window.confirm(
        `${assignmentWarnings.join(
          '\n',
        )}\n\nAssign anyway?`,
      )
    ) {
      return;
    }

    setPending(true);
    setError('');

    try {
      const finalMembers = [
        ...new Set([
          ownerId,
          ...memberIds,
        ]),
      ];

      const response = await fetch(
        `/api/projects/${project.id}`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            departmentId,
            goalId: selectedGoalId,

            clientName,
            name,
            jobCode,
            description,

            ownerId,

            memberIds:
              finalMembers,

            startDate,
            deadline,

            status:
              PROJECT_STATUS_VALUES[
                status
              ],

            budget,
          }),
        },
      );

      const body =
        (await response.json()) as {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          body.error ??
            'Could not update project.',
        );
      }

      setEditing(false);

      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not update project.',
      );
    } finally {
      setPending(false);
    }
  }

  async function updateClosure(
    itemId: string,

    changes: {
      assignedMemberId?:
        | string
        | null;

      completed?: boolean;
    },
  ) {
    setPendingClosureId(itemId);
    setError('');

    try {
      const response = await fetch(
        `/api/projects/${project.id}/closure/${itemId}`,
        {
          method: 'PATCH',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify(
            changes,
          ),
        },
      );

      const body =
        (await response.json()) as {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          body.error ??
            'Could not update checklist.',
        );
      }

      router.refresh();
    } catch (closureError) {
      setError(
        closureError instanceof Error
          ? closureError.message
          : 'Could not update checklist.',
      );
    } finally {
      setPendingClosureId('');
    }
  }

  return (
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/projects"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            ← All projects
          </Link>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">
              {project.name}
            </h1>

            <StatusBadge
              status={project.status}
            />
          </div>

          <p className="mt-1 text-sm text-slate-500">
            {project.clientName ??
              'Client not set'}{' '}
            ·{' '}
            {project.jobCode ??
              'No job code'}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setEditing(
              (current) => !current,
            )
          }
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {editing ? (
            <X size={17} />
          ) : (
            <Pencil size={17} />
          )}

          {editing
            ? 'Cancel edit'
            : 'Edit project'}
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {editing ? (
        <form
          onSubmit={saveProject}
          className="mb-7 rounded-xl border border-blue-100 bg-white p-6 shadow-sm"
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Edit Project
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Update project details,
              KEY / Goal, owner and
              team members.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Department

              <select
                required
                value={departmentId}
                onChange={(event) =>
                  changeDepartment(
                    event.target.value,
                  )
                }
                className={
                  fieldClass
                }
              >
                {departments.map(
                  (department) => (
                    <option
                      key={
                        department.id
                      }
                      value={
                        department.id
                      }
                    >
                      {
                        department.name
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              KEY / Goal

              <select
                required
                value={
                  selectedGoalId
                }
                onChange={(event) =>
                  setGoalId(
                    event.target
                      .value,
                  )
                }
                className={
                  fieldClass
                }
              >
                {selectedDepartment
                  ?.goals.length ? (
                  selectedDepartment.goals.map(
                    (goal) => (
                      <option
                        key={
                          goal.id
                        }
                        value={
                          goal.id
                        }
                      >
                        {goal.code
                          ? `${goal.code} · `
                          : ''}

                        {goal.title}
                      </option>
                    ),
                  )
                ) : (
                  <option value="">
                    No active goals
                  </option>
                )}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Client name

              <input
                required
                value={clientName}
                onChange={(event) =>
                  setClientName(
                    event.target.value,
                  )
                }
                className={
                  fieldClass
                }
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Project / Job name

              <input
                required
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value,
                  )
                }
                className={
                  fieldClass
                }
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Job code

              <input
                required
                value={jobCode}
                onChange={(event) =>
                  setJobCode(
                    event.target.value,
                  )
                }
                className={
                  fieldClass
                }
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Owner

              <select
                required
                value={ownerId}
                onChange={(event) =>
                  changeOwner(
                    event.target.value,
                  )
                }
                className={
                  fieldClass
                }
              >
                <option value="">
                  Select owner
                </option>

                {departmentMembers.map(
                  (member) => (
                    <option
                      key={
                        member.memberId
                      }
                      value={
                        member.memberId
                      }
                    >
                      {
                        member.memberName
                      }{' '}
                      ·{' '}
                      {
                        member.capacityStatus
                      }
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Start date

              <input
                required
                type="date"
                value={startDate}
                onChange={(event) =>
                  setStartDate(
                    event.target.value,
                  )
                }
                className={
                  fieldClass
                }
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Deadline

              <input
                required
                type="date"
                min={
                  startDate ||
                  undefined
                }
                value={deadline}
                onChange={(event) =>
                  setDeadline(
                    event.target.value,
                  )
                }
                className={
                  fieldClass
                }
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Status

              <select
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target
                      .value as typeof status,
                  )
                }
                className={
                  fieldClass
                }
              >
                {PROJECT_STATUSES.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Budget (INR)

              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={budget}
                onChange={(event) =>
                  setBudget(
                    event.target.value,
                  )
                }
                className={
                  fieldClass
                }
              />
            </label>

            <label className="text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3">
              Description

              <textarea
                rows={3}
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value,
                  )
                }
                className={`${fieldClass} resize-none`}
              />
            </label>

            <fieldset className="md:col-span-2 xl:col-span-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <legend className="text-sm font-semibold text-slate-800">
                    Assign Team Members
                  </legend>

                  <p className="mt-1 text-xs text-slate-500">
                    All active team
                    members from all
                    departments are shown
                    below. The project
                    owner is selected
                    automatically.
                  </p>
                </div>

                <p className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {
                    selectedMemberIds.size
                  }{' '}
                  selected
                </p>
              </div>

              <div className="mt-4 max-h-[430px] overflow-y-auto rounded-xl border border-slate-200 p-3">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {departmentMembers.map(
                    (member) => {
                      const projected =
                        projectedCapacity(
                          member,
                        );

                      const selected =
                        selectedMemberIds.has(
                          member.memberId,
                        );

                      const newlyAssigned =
                        selected &&
                        !project.memberIds.includes(
                          member.memberId,
                        );

                      const overProjectLimit =
                        newlyAssigned &&
                        isActiveProjectStatus(
                          status,
                        ) &&
                        projected.activeProjectCount >
                          MAX_ACTIVE_PROJECTS;

                      const showOverloadWarning =
                        newlyAssigned &&
                        (member.capacityStatus ===
                          'Overloaded' ||
                          projected.status ===
                            'Overloaded');

                      return (
                        <label
                          key={
                            member.memberId
                          }
                          className={`cursor-pointer rounded-xl border p-4 text-sm transition ${
                            showOverloadWarning ||
                            overProjectLimit
                              ? 'border-red-300 bg-red-50'
                              : selected
                                ? 'border-blue-400 bg-blue-50 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                          }`}
                        >
                          <span className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4"
                              checked={
                                selected
                              }
                              disabled={
                                member.memberId ===
                                ownerId
                              }
                              onChange={() =>
                                toggleMember(
                                  member.memberId,
                                )
                              }
                            />

                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold text-slate-800">
                                  {
                                    member.memberName
                                  }
                                </span>

                                <CapacityBadge
                                  status={
                                    member.capacityStatus
                                  }
                                />
                              </span>

                              <span className="mt-2 block text-xs text-slate-500">
                                {
                                  member.role
                                }
                              </span>

                              <span className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-600">
                                <span>
                                  {
                                    member.activeProjectCount
                                  }{' '}
                                  active
                                  projects
                                </span>

                                <span>
                                  {
                                    member.openTaskCount
                                  }{' '}
                                  open
                                  tasks
                                </span>

                                <span>
                                  {
                                    member.dueThisWeekTaskCount
                                  }{' '}
                                  due this
                                  week
                                </span>

                                <span>
                                  {
                                    member.completedThisWeekTaskCount
                                  }{' '}
                                  done this
                                  week
                                </span>
                              </span>

                              {member.memberId ===
                                ownerId && (
                                <span className="mt-3 inline-block rounded-full bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                                  Project
                                  Owner
                                </span>
                              )}

                              {newlyAssigned &&
                                isActiveProjectStatus(
                                  status,
                                ) && (
                                  <span className="mt-2 block text-xs font-medium text-slate-700">
                                    After
                                    assignment:{' '}
                                    {
                                      projected.activeProjectCount
                                    }{' '}
                                    active ·{' '}
                                    {
                                      projected.status
                                    }
                                  </span>
                                )}

                              {(showOverloadWarning ||
                                overProjectLimit) && (
                                <span className="mt-2 flex gap-1.5 text-xs font-semibold text-red-700">
                                  <AlertTriangle
                                    className="shrink-0"
                                    size={
                                      14
                                    }
                                  />

                                  Capacity
                                  review
                                  recommended.
                                </span>
                              )}
                            </span>
                          </span>
                        </label>
                      );
                    },
                  )}
                </div>

                {!departmentMembers.length && (
                  <p className="p-6 text-center text-sm text-slate-500">
                    No active team
                    members found.
                  </p>
                )}
              </div>
            </fieldset>
          </div>

          {assignmentWarnings.length >
            0 && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle
                  size={17}
                />

                Capacity warning
              </p>

              <ul className="mt-2 list-disc space-y-1 pl-5">
                {assignmentWarnings.map(
                  (warning) => (
                    <li key={warning}>
                      {warning}
                    </li>
                  ),
                )}
              </ul>

              <p className="mt-2 text-xs">
                This is only a soft
                warning. You can still
                save the project.
              </p>
            </div>
          )}

          {status === 'Closed' &&
            !allClosureComplete && (
            <p className="mt-4 text-sm text-amber-700">
              Closed will be rejected
              until all required closure
              items are completed.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={
                pending ||
                !ownerId ||
                !selectedGoalId
              }
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending
                ? 'Saving…'
                : 'Save changes'}
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={() =>
                setEditing(false)
              }
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <section className="mb-7 rounded-xl border border-slate-200 bg-white p-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Department
              </p>

              <p className="mt-1 text-sm font-medium text-slate-800">
                {
                  project.departmentName
                }
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Goal / KEY
              </p>

              <p className="mt-1 text-sm font-medium text-slate-800">
                {project.goalTitle}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Owner
              </p>

              <p className="mt-1 text-sm font-medium text-slate-800">
                {project.ownerName ??
                  '—'}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Budget
              </p>

              <p className="mt-1 text-sm font-medium text-slate-800">
                {formatBudget(
                  project.budget,
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Start
              </p>

              <p className="mt-1 text-sm font-medium text-slate-800">
                {formatDate(
                  project.startDate,
                )}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Deadline
              </p>

              <p className="mt-1 text-sm font-medium text-slate-800">
                {formatDate(
                  project.deadline,
                )}
              </p>
            </div>

            <div className="sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Description
              </p>

              <p className="mt-1 text-sm text-slate-700">
                {project.description ??
                  '—'}
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="mb-7 grid gap-5 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-slate-900">
                Overall project
                progress
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Calculated
                automatically from
                linked daily tasks.
              </p>
            </div>

            <span className="text-3xl font-bold text-slate-900">
              {Math.round(
                project.progress,
              )}
              %
            </span>
          </div>

          <ProgressBar
            value={project.progress}
            className="mt-5"
          />

          <div className="mt-3 flex gap-5 text-sm text-slate-500">
            <span>
              {project.totalTasks}{' '}
              total tasks
            </span>

            <span>
              {project.doneTasks}{' '}
              completed
            </span>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Users size={18} />

            Assigned members
          </h2>

          <div className="mt-4 space-y-2">
            {project.memberIds.map(
              (id, index) => (
                <Link
                  key={id}
                  href={`/members/${id}`}
                  className="block rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                >
                  {project.memberNames[
                    index
                  ] ?? 'Team member'}
                </Link>
              ),
            )}
          </div>

          {!project.memberIds.length && (
            <p className="mt-3 text-sm text-slate-500">
              No members assigned.
            </p>
          )}
        </section>
      </div>

      <section className="mb-7 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <ClipboardCheck
                size={19}
              />

              Job Closure checklist
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Assign every
              deliverable, then
              complete all required
              items before closing.
            </p>
          </div>

          <span className="text-sm font-semibold text-slate-700">
            {completedClosure}/
            {
              project.closureItems
                .length
            }{' '}
            complete
          </span>
        </div>

        <ProgressBar
          value={
            project.closureItems.length
              ? (completedClosure /
                  project.closureItems
                    .length) *
                100
              : 0
          }
          size="sm"
          className="mt-4"
        />

        <div className="mt-5 divide-y divide-slate-100">
          {project.closureItems.map(
            (item) => (
              <div
                key={item.id}
                className="grid gap-3 py-4 md:grid-cols-[1fr_240px_auto] md:items-center"
              >
                <div className="flex items-center gap-3">
                  {item.completed ? (
                    <CheckCircle2
                      className="text-emerald-500"
                      size={20}
                    />
                  ) : (
                    <Circle
                      className="text-slate-300"
                      size={20}
                    />
                  )}

                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {
                        item.label
                      }
                    </p>

                    {item.required && (
                      <p className="text-xs text-slate-400">
                        Required
                      </p>
                    )}
                  </div>
                </div>

                <select
                  aria-label={`Assignee for ${item.label}`}
                  value={
                    item.assignedMemberId ??
                    ''
                  }
                  disabled={
                    pendingClosureId ===
                      item.id ||
                    project.status ===
                      'Closed'
                  }
                  onChange={(
                    event,
                  ) =>
                    void updateClosure(
                      item.id,
                      {
                        assignedMemberId:
                          event
                            .target
                            .value ||
                          null,
                      },
                    )
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">
                    Unassigned
                  </option>

                  {project.memberIds.map(
                    (id, index) => (
                      <option
                        key={id}
                        value={id}
                      >
                        {project
                          .memberNames[
                          index
                        ] ??
                          'Team member'}
                      </option>
                    ),
                  )}
                </select>

                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={
                      item.completed
                    }
                    disabled={
                      pendingClosureId ===
                        item.id ||
                      !item.assignedMemberId ||
                      project.status ===
                        'Closed'
                    }
                    onChange={(
                      event,
                    ) =>
                      void updateClosure(
                        item.id,
                        {
                          completed:
                            event
                              .target
                              .checked,
                        },
                      )
                    }
                  />

                  Complete
                </label>
              </div>
            ),
          )}
        </div>
      </section>

      <div className="grid gap-7 xl:grid-cols-2">
        <section>
          <h2 className="mb-4 font-semibold text-slate-900">
            Linked actions
          </h2>

          <div className="space-y-3">
            {project.actions.map(
              (action) => (
                <div
                  key={action.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex justify-between gap-3">
                    <p className="text-sm font-medium text-slate-800">
                      {action.code
                        ? `${action.code} · `
                        : ''}

                      {action.title}
                    </p>

                    <span className="text-sm font-semibold">
                      {Math.round(
                        action.progress,
                      )}
                      %
                    </span>
                  </div>

                  <ProgressBar
                    value={
                      action.progress
                    }
                    size="sm"
                    className="mt-3"
                  />
                </div>
              ),
            )}

            {!project.actions
              .length && (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                No actions are linked
                through weekly goals
                yet.
              </p>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-4 font-semibold text-slate-900">
            Linked weekly goals
          </h2>

          <div className="space-y-3">
            {project.weekGoals.map(
              (weekGoal) => (
                <div
                  key={weekGoal.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {
                          weekGoal.title
                        }
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {
                          weekGoal.assignedMemberName
                        }{' '}
                        ·{' '}
                        {formatDate(
                          weekGoal.weekStart,
                        )}
                        –
                        {formatDate(
                          weekGoal.weekEnd,
                        )}
                      </p>
                    </div>

                    <span className="text-sm font-semibold">
                      {Math.round(
                        weekGoal.progress,
                      )}
                      %
                    </span>
                  </div>

                  <ProgressBar
                    value={
                      weekGoal.progress
                    }
                    size="sm"
                    className="mt-3"
                  />
                </div>
              ),
            )}

            {!project.weekGoals
              .length && (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                No weekly goals
                linked yet.
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="mt-7">
        <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
          <CalendarDays size={18} />

          Daily tasks and task
          progress
        </h2>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">
                    Task
                  </th>

                  <th className="px-4 py-3">
                    Action / Week
                    goal
                  </th>

                  <th className="px-4 py-3">
                    Member
                  </th>

                  <th className="px-4 py-3">
                    Date
                  </th>

                  <th className="px-4 py-3">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {project.tasks.map(
                  (task) => (
                    <tr key={task.id}>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {
                          task.title
                        }
                      </td>

                      <td className="px-4 py-3 text-slate-500">
                        {
                          task.actionTitle
                        }

                        <br />

                        <span className="text-xs">
                          {
                            task.weekGoalTitle
                          }
                        </span>
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {project
                          .memberNames[
                          project.memberIds.indexOf(
                            task.assignedMemberId,
                          )
                        ] ?? '—'}
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(
                          task.taskDate,
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <StatusBadge
                          status={
                            task.status
                          }
                          size="sm"
                        />
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>

          {!project.tasks.length && (
            <p className="p-8 text-center text-sm text-slate-500">
              No daily tasks linked
              yet.
            </p>
          )}
        </div>
      </section>
    </>
  );
}