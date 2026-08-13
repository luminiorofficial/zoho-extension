import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

import ProgressBar from '@/components/common/ProgressBar';
import StatusBadge from '@/components/common/StatusBadge';
import type { Department, Member, WeekGoal } from '@/types';

interface DepartmentExecutionProps {
  department: Department;
  members: Member[];
  weekGoals: WeekGoal[];
}

function formatWeek(start: string, end: string): string {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  return `${formatter.format(new Date(`${start}T00:00:00Z`))} – ${formatter.format(new Date(`${end}T00:00:00Z`))}`;
}

export default function DepartmentExecution({
  department,
  members,
  weekGoals,
}: DepartmentExecutionProps) {
  const memberNames = new Map(members.map((member) => [member.id, member.name]));

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Execution Flow</h2>
        <p className="mt-1 text-sm text-slate-500">
          Department → Goal → Action → Member → Week Goal → Daily Task
        </p>
      </div>

      <div className="space-y-4">
        {department.goals.map((goal) => (
          <details key={goal.id} className="group rounded-xl border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Goal</p>
                <h3 className="mt-1 font-semibold text-slate-900">{goal.title}</h3>
              </div>
              <ChevronDown className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>

            <div className="space-y-4 border-t border-slate-100 p-5">
              {goal.actions.map((action) => (
                <div key={action.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Action</p>
                      <p className="mt-1 font-medium text-slate-800">
                        {action.code ? `${action.code} · ` : ''}{action.title}
                      </p>
                    </div>
                    <div className="w-36">
                      <div className="mb-1 text-right text-xs font-medium text-slate-500">
                        {Math.round(action.progress)}%
                      </div>
                      <ProgressBar value={action.progress} size="sm" />
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {action.assignedMemberIds.map((memberId) => {
                      const memberWeekGoals = weekGoals.filter(
                        (weekGoal) => weekGoal.actionId === action.id
                          && weekGoal.assignedMemberId === memberId,
                      );

                      return (
                        <div key={memberId} className="rounded-lg bg-slate-50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Member</p>
                              <Link
                                href={`/members/${memberId}`}
                                className="mt-1 inline-block text-sm font-semibold text-blue-700 hover:text-blue-800"
                              >
                                {memberNames.get(memberId) ?? 'Unknown member'}
                              </Link>
                            </div>
                            <span className="text-xs text-slate-500">
                              {memberWeekGoals.length} week goal{memberWeekGoals.length === 1 ? '' : 's'}
                            </span>
                          </div>

                          {memberWeekGoals.length ? (
                            <div className="mt-3 space-y-3">
                              {memberWeekGoals.map((weekGoal) => (
                                <div key={weekGoal.id} className="rounded-lg border border-slate-200 bg-white p-3">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                                        Week Goal · {formatWeek(weekGoal.weekStart, weekGoal.weekEnd)}
                                      </p>
                                      <p className="mt-1 text-sm font-medium text-slate-800">{weekGoal.title}</p>
                                      <p className="mt-1 text-xs text-slate-500">Project: {weekGoal.projectName}</p>
                                    </div>
                                    <span className="text-sm font-semibold text-slate-700">{Math.round(weekGoal.progress)}%</span>
                                  </div>

                                  <div className="mt-3 space-y-2">
                                    {weekGoal.tasks.map((task) => (
                                      <div key={task.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                                        <div>
                                          <p className="text-sm text-slate-700">{task.title}</p>
                                          <p className="text-xs text-slate-400">Daily task · {task.taskDate}</p>
                                        </div>
                                        <StatusBadge status={task.status} size="sm" />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-slate-400">No weekly goals or daily tasks yet.</p>
                          )}
                        </div>
                      );
                    })}

                    {!action.assignedMemberIds.length && (
                      <p className="text-sm text-slate-400">No member assigned to this action.</p>
                    )}
                  </div>
                </div>
              ))}

              {!goal.actions.length && (
                <p className="text-sm text-slate-500">No actions recorded for this goal.</p>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
