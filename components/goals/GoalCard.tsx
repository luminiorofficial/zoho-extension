import ProgressBar from '@/components/common/ProgressBar';
import StatusBadge from '@/components/common/StatusBadge';

import type { GoalCardProps } from '@/types';

export default function GoalCard({
  goal,
  members,
}: GoalCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">

      <div className="border-b border-slate-100 p-5">

        <div className="flex items-start justify-between">

          <div>
            <h3 className="font-semibold text-slate-900">
              {goal.title}
            </h3>

            {goal.description && (
              <p className="mt-1 text-sm text-slate-500">
                {goal.description}
              </p>
            )}
          </div>

          <span className="font-semibold text-blue-600">
            {goal.progress}%
          </span>

        </div>

        <div className="mt-4">
          <ProgressBar
            value={goal.progress}
            size="sm"
          />
        </div>

      </div>

      <div className="p-5">

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

        </div>

      </div>

    </div>
  );
}