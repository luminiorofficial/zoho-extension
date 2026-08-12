'use client';

import Link from 'next/link';
import { MemberBadge } from '@/components/members/MemberBadge';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ProgressBar } from '@/components/common/ProgressBar';
import { ActionCardProps } from '@/types';

export default function ActionCard({
  action,
  members,
}: ActionCardProps) {
  return (
    <div
      className="p-4 border border-zinc-200 rounded-lg bg-white shadow-sm"
    >
      <h3 className="text-lg font-semibold text-zinc-800 mb-2">
        {action.title}
      </h3>

      {action.description && (
        <p className="text-zinc-600 mb-3">{action.description}</p>
      )}

      <div className="space-y-2">
        {/* Assigned Members */}
        <div>
          <p className="font-medium text-sm text-zinc-600 mb-1">
            Assigned:
          </p>
          <div className="flex flex-wrap gap-1">
            {action.assignedMemberIds.map(memberId => {
              const member = members.find(m => m.id === memberId);
              return member ? (
                <MemberBadge key={member.id} member={member} />
              ) : null;
            })}
          </div>
        </div>

        {/* Status */}
        <div>
          <p className="font-medium text-sm text-zinc-600 mb-1">
            Status:
          </p>
          <StatusBadge status={action.status as any} size="sm" />
        </div>

        {/* Progress */}
        <div>
          <p className="font-medium text-sm text-zinc-600 mb-1">
            Progress:
          </p>
          <ProgressBar value={action.progress} label />
        </div>

        {/* Due Date */}
        {action.dueDate && (
          <div>
            <p className="font-medium text-sm text-zinc-600 mb-1">
              Due Date:
            </p>
            <p className="text-zinc-800">
              {new Date(action.dueDate).toLocaleDateString()}
            </p>
          </div>
        )}

        {/* Priority */}
        {action.priority && (
          <div>
            <p className="font-medium text-sm text-zinc-600 mb-1">
              Priority:
            </p>
            <span
              className={cn(
                'px-2 py-0.5 rounded text-xs font-medium',
                action.priority === 'High'
                  ? 'bg-red-100 text-red-800'
                  : action.priority === 'Medium'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-green-100 text-green-800'
              )}
            >
              {action.priority}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}