import type { ReactNode } from 'react';

import StatusBadge from '@/components/common/StatusBadge';
import type { KeyAssignment } from '@/types';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function keyLabel(assignment: KeyAssignment): string {
  return assignment.keyCode.replace('_', ' ');
}

function HierarchyHeading({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-3">
      <span aria-hidden="true" className="mr-2 text-blue-500">→</span>
      {children}
    </th>
  );
}

export default function AssignmentHierarchy({
  assignments,
  emptyMessage = 'No key assignments match this view.',
  highlightedAssignmentId,
  renderDataActions,
}: {
  assignments: KeyAssignment[];
  emptyMessage?: string;
  highlightedAssignmentId?: string;
  renderDataActions?: (assignment: KeyAssignment) => ReactNode;
}) {
  if (!assignments.length) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Key</th>
              <HierarchyHeading>Sub Goal</HierarchyHeading>
              <HierarchyHeading>Project</HierarchyHeading>
              <HierarchyHeading>Task</HierarchyHeading>
              <HierarchyHeading>Member</HierarchyHeading>
              <HierarchyHeading>Data</HierarchyHeading>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assignments.map((assignment) => (
              <tr
                key={assignment.id}
                className={assignment.id === highlightedAssignmentId ? 'bg-blue-50/70' : undefined}
              >
                <td className="px-4 py-4 font-medium text-slate-800">
                  {keyLabel(assignment)}
                </td>
                <td className="px-4 py-4 text-slate-700">
                  {assignment.subGoalTitle}
                </td>
                <td className="px-4 py-4">
                  <p className="font-medium text-slate-800">{assignment.projectName}</p>
                  <p className="text-xs text-slate-500">{assignment.departmentName}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="font-medium text-slate-800">{assignment.taskTitle}</p>
                  {assignment.taskCategory !== 'General' && (
                    <p className="text-xs text-slate-500">{assignment.taskCategory}</p>
                  )}
                </td>
                <td className="px-4 py-4 text-slate-700">
                  {assignment.memberName}
                </td>
                <td className="min-w-[230px] px-4 py-4">
                  <dl className="space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="font-medium text-slate-500">Start Date</dt>
                      <dd className="whitespace-nowrap text-slate-700">
                        {formatDate(assignment.startDate)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="font-medium text-slate-500">End Date</dt>
                      <dd className="whitespace-nowrap text-slate-700">
                        {formatDate(assignment.endDate)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="font-medium text-slate-500">Status</dt>
                      <dd><StatusBadge status={assignment.status} size="sm" /></dd>
                    </div>
                  </dl>
                  {renderDataActions && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      {renderDataActions(assignment)}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
