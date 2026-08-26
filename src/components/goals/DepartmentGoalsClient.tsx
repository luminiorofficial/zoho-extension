'use client';

import {
  useRouter,
} from 'next/navigation';

import {
  useState,
} from 'react';

import {
  ChevronDown,
  Pencil,
  Plus,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

import ProgressBar from '@/components/common/ProgressBar';
import StatusBadge from '@/components/common/StatusBadge';

import ActionFormModal from './ActionFormModal';
import GoalFormModal from './GoalFormModal';
import TargetFormModal from './TargetFormModal';

import type {
  Action,
  Department,
  Goal,
  Member,
  Target,
} from '@/types';

interface DepartmentGoalsClientProps {
  department: Department;
  members: Member[];
}

type Editor =
  | {
      kind: 'goal';
      item: Goal | null;
    }
  | {
      kind: 'target';
      goalId: string;
      item: Target | null;
    }
  | {
      kind: 'action';
      goalId: string;
      item: Action | null;
    }
  | null;

export default function DepartmentGoalsClient({
  department,
  members,
}: DepartmentGoalsClientProps) {
  const router = useRouter();

  const [editor, setEditor] =
    useState<Editor>(null);

  const [pendingKey, setPendingKey] =
    useState('');

  const [error, setError] =
    useState('');

  const memberNames = new Map(
    members.map((member) => [
      member.id,
      member.name,
    ]),
  );

  async function setActive(
    kind:
      | 'goals'
      | 'targets'
      | 'actions',

    id: string,

    name: string,

    isActive: boolean,
  ) {
    if (
      !isActive &&
      !window.confirm(
        `Deactivate ${name}? Existing imported data and work history will be retained.`,
      )
    ) {
      return;
    }

    const key = `${kind}:${id}`;

    setPendingKey(key);
    setError('');

    try {
      const response = await fetch(
        `/api/${kind}/${id}`,
        {
          method: isActive
            ? 'PATCH'
            : 'DELETE',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: isActive
            ? JSON.stringify({
                isActive: true,
              })
            : undefined,
        },
      );

      const body =
        (await response.json()) as {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          body.error ??
            'Could not update the item.',
        );
      }

      router.refresh();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'Could not update the item.',
      );
    } finally {
      setPendingKey('');
    }
  }

  function editButton(
    label: string,
    onClick: () => void,
  ) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();

          onClick();
        }}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        aria-label={label}
      >
        <Pencil size={15} />
      </button>
    );
  }

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Department Goals /
            KEY Objectives
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Create KEY A, KEY B,
            KEY C and add individual
            actions like A1, A2, B1,
            B2, C1 and C2.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setEditor({
              kind: 'goal',
              item: null,
            })
          }
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />

          Add Goal / KEY
        </button>
      </div>

      {!department.isActive && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This department is
          currently marked inactive
          in the database. Creating a
          goal may require activating
          the department first.
        </div>
      )}

      {!members.length && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This department currently
          has no members. Add or
          assign at least one member
          before creating manual
          goals and actions.
        </div>
      )}

      {error && (
        <p
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="space-y-5">
        {department.goals.map(
          (goal) => {
            const goalActive =
              goal.isActive !== false;

            return (
              <details
                key={goal.id}
                name="department-goals"
                className={`group overflow-hidden rounded-xl border bg-white ${
                  goalActive
                    ? 'border-slate-200'
                    : 'border-slate-200 opacity-75'
                }`}
              >
                <summary className="cursor-pointer list-none p-5 transition-colors hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900">
                          {goal.code
                            ? `${goal.code} · `
                            : ''}

                          {goal.title}
                        </h3>

                        {!goalActive && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                            Inactive
                          </span>
                        )}
                      </div>

                      {goal.description && (
                        <p className="mt-1 text-sm text-slate-500">
                          {
                            goal.description
                          }
                        </p>
                      )}

                      <p className="mt-2 text-xs text-slate-400">
                        Owner:{' '}
                        {goal.ownerMemberId
                          ? memberNames.get(
                              goal.ownerMemberId,
                            ) ??
                            'Unknown member'
                          : 'Not assigned'}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {editButton(
                        `Edit ${goal.title}`,
                        () =>
                          setEditor({
                            kind: 'goal',
                            item: goal,
                          }),
                      )}

                      <button
                        type="button"
                        disabled={
                          pendingKey ===
                          `goals:${goal.id}`
                        }
                        onClick={(
                          event,
                        ) => {
                          event.preventDefault();
                          event.stopPropagation();

                          void setActive(
                            'goals',
                            goal.id,
                            goal.title,
                            !goalActive,
                          );
                        }}
                        className={`rounded-md p-1.5 hover:bg-slate-100 ${
                          goalActive
                            ? 'text-red-500'
                            : 'text-emerald-600'
                        }`}
                        aria-label={
                          goalActive
                            ? `Deactivate ${goal.title}`
                            : `Reactivate ${goal.title}`
                        }
                      >
                        {goalActive ? (
                          <ToggleRight
                            size={19}
                          />
                        ) : (
                          <ToggleLeft
                            size={19}
                          />
                        )}
                      </button>

                      <span className="ml-2 font-semibold text-blue-600">
                        {Math.round(
                          goal.progress,
                        )}
                        %
                      </span>

                      <ChevronDown className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180" />
                    </div>
                  </div>

                  <div className="mt-4">
                    <ProgressBar
                      value={
                        goal.progress
                      }
                      size="sm"
                    />
                  </div>
                </summary>

                <div className="border-t border-slate-100 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Targets / KPI
                    </p>

                    <button
                      type="button"
                      disabled={
                        !goalActive
                      }
                      onClick={() =>
                        setEditor({
                          kind: 'target',
                          goalId:
                            goal.id,
                          item: null,
                        })
                      }
                      className="flex items-center gap-1 text-xs font-semibold text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus
                        size={14}
                      />

                      Add Target
                    </button>
                  </div>

                  {goal.targets
                    ?.length ? (
                    <div className="mb-6 space-y-3">
                      {goal.targets.map(
                        (target) => {
                          const active =
                            target.isActive !==
                            false;

                          return (
                            <div
                              key={
                                target.id
                              }
                              className={`rounded-lg border border-blue-100 bg-blue-50/50 p-4 ${
                                active
                                  ? ''
                                  : 'opacity-60'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium text-slate-800">
                                      {
                                        target.title
                                      }
                                    </p>

                                    {!active && (
                                      <span className="text-xs text-slate-400">
                                        Inactive
                                      </span>
                                    )}
                                  </div>

                                  {target.targetText &&
                                    target.targetText !==
                                      target.title && (
                                      <p className="mt-1 text-sm text-slate-600">
                                        {
                                          target.targetText
                                        }
                                      </p>
                                    )}

                                  <p className="mt-2 text-xs font-medium text-blue-700">
                                    {target.targetValue !==
                                    undefined
                                      ? `${target.targetValue}${
                                          target.targetUnit
                                            ? ` ${target.targetUnit}`
                                            : ''
                                        }`
                                      : 'Text KPI'}

                                    {target.periodType
                                      ? ` · ${target.periodType}`
                                      : ''}
                                  </p>
                                </div>

                                <div className="flex items-center gap-1">
                                  {editButton(
                                    `Edit ${target.title}`,
                                    () =>
                                      setEditor(
                                        {
                                          kind: 'target',
                                          goalId:
                                            goal.id,
                                          item: target,
                                        },
                                      ),
                                  )}

                                  <button
                                    type="button"
                                    disabled={
                                      pendingKey ===
                                      `targets:${target.id}`
                                    }
                                    onClick={() =>
                                      void setActive(
                                        'targets',
                                        target.id,
                                        target.title,
                                        !active,
                                      )
                                    }
                                    className={`rounded-md p-1.5 hover:bg-white ${
                                      active
                                        ? 'text-red-500'
                                        : 'text-emerald-600'
                                    }`}
                                  >
                                    {active ? (
                                      <ToggleRight
                                        size={
                                          18
                                        }
                                      />
                                    ) : (
                                      <ToggleLeft
                                        size={
                                          18
                                        }
                                      />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  ) : (
                    <p className="mb-6 text-sm text-slate-500">
                      No targets or
                      KPI recorded.
                    </p>
                  )}

                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Tasks /
                        Actions
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Example: A1,
                        A2, A3, B1,
                        B2, C1.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={
                        !goalActive
                      }
                      onClick={() =>
                        setEditor({
                          kind: 'action',
                          goalId:
                            goal.id,
                          item: null,
                        })
                      }
                      className="flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus
                        size={14}
                      />

                      Add Action
                    </button>
                  </div>

                  <div className="space-y-3">
                    {goal.actions.map(
                      (action) => {
                        const active =
                          action.isActive !==
                          false;

                        const assigned =
                          action.assignedMemberIds
                            .map((id) =>
                              memberNames.get(
                                id,
                              ),
                            )
                            .filter(
                              Boolean,
                            );

                        return (
                          <div
                            key={
                              action.id
                            }
                            className={`rounded-lg border border-slate-200 p-4 ${
                              active
                                ? ''
                                : 'bg-slate-50 opacity-65'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-slate-800">
                                    {action.code
                                      ? `${action.code} · `
                                      : ''}

                                    {
                                      action.title
                                    }
                                  </p>

                                  {!active && (
                                    <span className="text-xs text-slate-400">
                                      Inactive
                                    </span>
                                  )}
                                </div>

                                <p className="mt-1 text-xs text-slate-500">
                                  Assigned
                                  to:{' '}
                                  {assigned.join(
                                    ', ',
                                  ) ||
                                    'Not assigned'}
                                </p>
                              </div>

                              <div className="flex items-center gap-1">
                                {action.status && (
                                  <StatusBadge
                                    status={
                                      action.status
                                    }
                                    size="sm"
                                  />
                                )}

                                {editButton(
                                  `Edit ${action.title}`,
                                  () =>
                                    setEditor(
                                      {
                                        kind: 'action',
                                        goalId:
                                          goal.id,
                                        item: action,
                                      },
                                    ),
                                )}

                                <button
                                  type="button"
                                  disabled={
                                    pendingKey ===
                                    `actions:${action.id}`
                                  }
                                  onClick={() =>
                                    void setActive(
                                      'actions',
                                      action.id,
                                      action.title,
                                      !active,
                                    )
                                  }
                                  className={`rounded-md p-1.5 hover:bg-slate-100 ${
                                    active
                                      ? 'text-red-500'
                                      : 'text-emerald-600'
                                  }`}
                                >
                                  {active ? (
                                    <ToggleRight
                                      size={
                                        18
                                      }
                                    />
                                  ) : (
                                    <ToggleLeft
                                      size={
                                        18
                                      }
                                    />
                                  )}
                                </button>
                              </div>
                            </div>

                            <div className="mt-4">
                              <ProgressBar
                                value={
                                  action.progress
                                }
                                size="sm"
                              />
                            </div>
                          </div>
                        );
                      },
                    )}

                    {!goal.actions
                      .length && (
                      <p className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500">
                        No actions
                        recorded. Use
                        Add Action to
                        create A1, A2,
                        B1, C1 etc.
                      </p>
                    )}
                  </div>
                </div>
              </details>
            );
          },
        )}

        {!department.goals
          .length && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="font-medium text-slate-700">
              No goals / KEY
              objectives recorded.
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Create KEY A, KEY B
              and KEY C to begin the
              STOP-style planning
              workflow.
            </p>

            <button
              type="button"
              onClick={() =>
                setEditor({
                  kind: 'goal',
                  item: null,
                })
              }
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus size={16} />

              Create First KEY
            </button>
          </div>
        )}
      </div>

      {editor?.kind ===
        'goal' && (
        <GoalFormModal
          departmentId={
            department.id
          }
          members={members}
          goal={editor.item}
          onClose={() =>
            setEditor(null)
          }
        />
      )}

      {editor?.kind ===
        'target' && (
        <TargetFormModal
          goalId={
            editor.goalId
          }
          target={
            editor.item
          }
          onClose={() =>
            setEditor(null)
          }
        />
      )}

      {editor?.kind ===
        'action' && (
        <ActionFormModal
          goalId={
            editor.goalId
          }
          members={members}
          action={
            editor.item
          }
          onClose={() =>
            setEditor(null)
          }
        />
      )}
    </section>
  );
}