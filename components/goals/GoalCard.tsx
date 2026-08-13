import { ChevronDown } from 'lucide-react';

import ProgressBar from '@/components/common/ProgressBar';
import StatusBadge from '@/components/common/StatusBadge';

import type { GoalCardProps } from '@/types';

export default function GoalCard({
  goal,
  members,
}: GoalCardProps) {
  return (
    <details
      name="department-goals"
      className="group overflow-hidden rounded-xl border border-slate-200 bg-white"
    >

      <summary className="cursor-pointer list-none p-5 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden">

        <div className="flex items-start justify-between gap-4">

          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">
              {goal.title}
            </h3>

            {goal.description && (
              <p className="mt-1 text-sm text-slate-500">
                {goal.description}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="font-semibold text-blue-600">
              {goal.progress}%
            </span>

            <ChevronDown
              aria-hidden="true"
              className="h-5 w-5 text-slate-400 transition-transform duration-200 group-open:rotate-180"
            />
          </div>

        </div>

        <div className="mt-4">
          <ProgressBar
            value={goal.progress}
            size="sm"
          />
        </div>

      </summary>

      <div className="border-t border-slate-100 p-5">

        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Targets / KPI
        </p>

        {goal.targets?.length ? (
          <div className="mb-6 space-y-3">
            {goal.targets.map((target) => (
              <div
                key={target.id}
                className="rounded-lg border border-blue-100 bg-blue-50/50 p-4"
              >
                <p className="font-medium text-slate-800">
                  {target.title}
                </p>

                {target.targetText && target.targetText !== target.title && (
                  <p className="mt-1 text-sm text-slate-600">
                    {target.targetText}
                  </p>
                )}

                {(target.targetValue !== undefined || target.periodType) && (
                  <p className="mt-2 text-xs font-medium text-blue-700">
                    {target.targetValue !== undefined
                      ? `${target.targetValue}${target.targetUnit ? ` ${target.targetUnit}` : ''}`
                      : ''}
                    {target.targetValue !== undefined && target.periodType ? ' · ' : ''}
                    {target.periodType ?? ''}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-6 text-sm text-slate-500">
            No targets or KPI recorded.
          </p>
        )}

        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Tasks / Actions
        </p>

        <div className="space-y-3">

          {goal.actions.map((action) => {
            const assignedMembers = members.filter((member) =>
              action.assignedMemberIds.includes(member.id)
            );

            return (
              <div
                key={action.id}
                className="rounded-lg border border-slate-200 p-4"
              >

                <div className="flex items-start justify-between gap-4">

                  <div>
                    <p className="font-medium text-slate-800">
                      {action.code ? `${action.code} · ` : ''}
                      {action.title}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Assigned to:{' '}
                      {assignedMembers.length
                        ? assignedMembers
                            .map((member) => member.name)
                            .join(', ')
                        : 'Not assigned'}
                    </p>
                  </div>

                  <StatusBadge
                    status={action.status}
                    size="sm"
                  />

                </div>

                <div className="mt-4">
                  <ProgressBar
                    value={action.progress}
                    size="sm"
                  />
                </div>

              </div>
            );
          })}

          {!goal.actions.length && (
            <p className="text-sm text-slate-500">
              No actions recorded.
            </p>
          )}

        </div>

      </div>

    </details>
  );
}
