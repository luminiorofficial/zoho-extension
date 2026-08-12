'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DepartmentCardProps } from '@/types';

export default function DepartmentCard({
  department,
  onActionClick,
}: DepartmentCardProps) {
  const router = useRouter();

  return (
    <div
      className={cn(
        'rounded-lg bg-white shadow-sm hover:shadow-sm-hover border border-zinc-100',
        'overflow-hidden flex flex-col'
      )}
    >
      <div className="flex flex-col flex-1 items-start justify-between py-4 px-4">
        <div className="overflow-hidden justify-between h-16">
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold text-neutral-800">
              {department.name}
            </h1>
            {onActionClick && <span>→</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 py-4">
          <div>
            <p className="text-sm text-zinc-500">
              <span className="font-medium">Members:</span> {department.memberIds.length}
            </p>
          </div>
          <div>
            <p className="text-sm text-zinc-500">
              <span className="font-medium">Goals:</span> {department.goals.length}
            </p>
          </div>
        </div>

        <div className="flex items-center mb-3">
          <span className="font-medium text-sm text-neutral-700">
            {department.description || 'Managing department operations'}
          </span>
        </div>

        <div className="mt-4 flex justify-between items-center">
          <span className="font-medium text-lg text-neutral-800">
            {percentageCalculation(department.progress)}
          </span>
          <div className="flex flex-wrap gap-2">
            {department.goals.slice(0, 3).map(goal => (
              <Link
                key={goal.id}
                href={`/departments/${department.id}/goals/${goal.id}`}
                className={cn(
                  'text-blue-500 hover:text-blue-700 text-sm truncate',
                  'break-all min-w-[120px]'
                )}
              >
                {goal.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function percentageCalculation(progress: number): string {
  return `${Math.round(progress)}%`;
}