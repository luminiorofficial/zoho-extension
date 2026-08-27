import StatusBadge from '@/components/common/StatusBadge';
import type { KeyAssignment } from '@/types';

type AssignmentView = 'department' | 'project' | 'member' | 'report';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function keyLabel(assignment: KeyAssignment): string {
  return assignment.keyCode.replace('_', ' ');
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    groups.set(value, [...(groups.get(value) ?? []), item]);
  }
  return groups;
}

function AssignmentRows({ assignments, view }: { assignments: KeyAssignment[]; view: AssignmentView }) {
  const showDepartment = view === 'report';
  const showProject = view === 'report';
  const showKey = view !== 'project';
  const showMember = view !== 'member';

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
          {showDepartment && <th className="px-4 py-3">Department</th>}
          {showProject && <th className="px-4 py-3">Project</th>}
          {showKey && <th className="px-4 py-3">Key</th>}
          <th className="px-4 py-3">Sub Goal</th>
          <th className="px-4 py-3">Task</th>
          {showMember && <th className="px-4 py-3">Member</th>}
          <th className="px-4 py-3">Dates</th>
          <th className="px-4 py-3">Status</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-100">
          {assignments.map((assignment) => <tr key={assignment.id}>
            {showDepartment && <td className="px-4 py-3 text-slate-700">{assignment.departmentName}</td>}
            {showProject && <td className="px-4 py-3 font-medium text-slate-800">{assignment.projectName}</td>}
            {showKey && <td className="px-4 py-3 font-medium text-slate-800">{keyLabel(assignment)}</td>}
            <td className="px-4 py-3 text-slate-700">{assignment.subGoalTitle}</td>
            <td className="px-4 py-3"><p className="font-medium text-slate-800">{assignment.taskTitle}</p>{assignment.taskCategory !== 'General' && <p className="text-xs text-slate-500">{assignment.taskCategory}</p>}</td>
            {showMember && <td className="px-4 py-3 text-slate-700">{assignment.memberName}</td>}
            <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(assignment.startDate)}<br /><span className="text-xs">to {formatDate(assignment.endDate)}</span></td>
            <td className="px-4 py-3"><StatusBadge status={assignment.status} size="sm" /></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  );
}

export default function AssignmentHierarchy({
  assignments,
  view,
  emptyMessage = 'No key assignments match this view.',
}: {
  assignments: KeyAssignment[];
  view: AssignmentView;
  emptyMessage?: string;
}) {
  if (!assignments.length) return <p className="text-sm text-slate-500">{emptyMessage}</p>;

  if (view === 'report') {
    return <div className="overflow-hidden rounded-lg border border-slate-200 bg-white"><AssignmentRows assignments={assignments} view={view} /></div>;
  }

  const groupKey = view === 'project'
    ? (assignment: KeyAssignment) => assignment.keyId
    : (assignment: KeyAssignment) => assignment.projectId;
  const groups = groupBy(assignments, groupKey);

  return <div className="space-y-4">{[...groups.values()].map((items) => {
    const first = items[0];
    const title = view === 'project'
      ? keyLabel(first)
      : first.projectName;
    const description = view === 'department'
      ? `${first.departmentName} · ${items.length} assignment${items.length === 1 ? '' : 's'}`
      : `${items.length} assignment${items.length === 1 ? '' : 's'}`;
    return <section key={view === 'project' ? first.keyId : first.projectId} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3"><h3 className="font-semibold text-slate-900">{title}</h3><p className="mt-0.5 text-xs text-slate-500">{description}</p></div>
      <AssignmentRows assignments={items} view={view} />
    </section>;
  })}</div>;
}
