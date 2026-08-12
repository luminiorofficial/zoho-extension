'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GoalCardProps } from '@/types';

export default function GoalCard({
  goal,
  onActionClick,
}: GoalCardProps) {
  const router = useRouter();

  return (
    <div
      className={cn(
        'rounded-lg border border-zinc-200 hover:shadow-sm hover:border-zinc-300',
        'overflow-hidden bg-white flex flex-col'
      )}
    >
      <div className="flex flex-col flex-1">
        <div className="flex items-start justify-between p-4 border-b border-zinc-100">
          <div>
            <h3 className="text-base font-semibold text-zinc-800">
              {goal.title}
            </h3>
            {goal.description && (
              <p className="text-sm text-zinc-500 mt-1">
                {goal.description}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="font-medium text-sm text-zinc-500">
              {goal.progress}%
            </span>
            <span className="text-xs text-zinc-400">
              {goal.actions.length} actions
            </span>
          </div>
        </div>

        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-zinc-200 mb-1">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-200"
              style={{ width: `${goal.progress}%` }}
            />
          </div>
          <p className="text-xs text-zinc-400">
            Goal progress: {goal.progress}%
          </p>
        </div>

        {goal.actions.map(action => (
          <div className="mt-2 ml-2">
            <Link
              href={`/departments/${goal.departmentId}/goals/${goal.id}/actions/${action.id}`}
              className="block w-full rounded-md px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 border border-blue-200"
            >
              <span className="font-medium">{action.title}</span>
              <span className="text-zinc-400 ml-1">
                ({action.status}) - {action.progress}%
              </span>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}