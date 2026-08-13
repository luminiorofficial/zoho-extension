'use client';

import { FormEvent, useState } from 'react';
import { CalendarDays, Check, ClipboardList, Pencil, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import PeriodProgressCards from '@/components/common/PeriodProgressCards';
import StatusBadge from '@/components/common/StatusBadge';
import WeeklyPlanner from '@/components/members/WeeklyPlanner';
import type {
  ActionStatus,
  DailyTask,
  Member,
  MemberWorkData,
} from '@/types';

interface MemberWorkClientProps {
  member: Member;
  initialWork: MemberWorkData;
}

const statusOptions: { label: ActionStatus; value: string }[] = [
  { label: 'Not Started', value: 'NOT_STARTED' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Done', value: 'DONE' },
];

function today(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function databaseStatus(status: ActionStatus): string {
  if (status === 'Done') return 'DONE';
  if (status === 'In Progress') return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

export default function MemberWorkClient({ member, initialWork }: MemberWorkClientProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialWork.tasks);
  const [showForm, setShowForm] = useState(false);
  const [weekGoalId, setWeekGoalId] = useState(initialWork.weekGoals[0]?.id ?? '');
  const [taskTitle, setTaskTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskDate, setTaskDate] = useState(today());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const selectedWeekGoal = initialWork.weekGoals.find((weekGoal) => weekGoal.id === weekGoalId)
    ?? initialWork.weekGoals[0];
  const selectedTaskDate = selectedWeekGoal
    && (taskDate < selectedWeekGoal.weekStart || taskDate > selectedWeekGoal.weekEnd)
    ? selectedWeekGoal.weekStart
    : taskDate;

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: member.id,
          weekGoalId: selectedWeekGoal?.id,
          title: taskTitle,
          description,
          taskDate: selectedTaskDate,
        }),
      });
      const body = await response.json() as { task?: DailyTask; error?: string };
      if (!response.ok || !body.task) throw new Error(body.error ?? 'Could not create task.');

      setTasks((current) => [body.task as DailyTask, ...current]);
      setTaskTitle('');
      setDescription('');
      setShowForm(false);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not create task.');
    } finally {
      setPending(false);
    }
  }

  async function updateTask(taskId: string, changes: Record<string, string>) {
    setPending(true);
    setError('');

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      const body = await response.json() as { task?: DailyTask; error?: string };
      if (!response.ok || !body.task) throw new Error(body.error ?? 'Could not update task.');

      setTasks((current) => current.map((task) => (
        task.id === taskId ? body.task as DailyTask : task
      )));
      setEditingId(null);
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update task.');
    } finally {
      setPending(false);
    }
  }

  function beginEdit(task: DailyTask) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description ?? '');
  }

  return (
    <>
      <section className="mb-8">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Current Progress</h2>
          <p className="mt-1 text-sm text-slate-500">
            Automatically calculated from daily task statuses.
          </p>
        </div>
        <PeriodProgressCards progress={initialWork.periodProgress} />
      </section>

      <WeeklyPlanner
        memberId={member.id}
        projects={initialWork.projects}
        actions={initialWork.actions}
        weekGoals={initialWork.weekGoals}
      />

      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Daily Tasks</h2>
            <p className="mt-1 text-sm text-slate-500">
              Goal → Action → Project → Week Goal → Daily Task
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowForm((current) => !current)}
            disabled={!initialWork.weekGoals.length}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {showForm ? <X size={17} /> : <Plus size={17} />}
            {showForm ? 'Cancel' : 'Add Daily Task'}
          </button>
        </div>

        {!initialWork.weekGoals.length && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Create a weekly goal in the planner before adding daily tasks.
          </div>
        )}

        {showForm && (
          <form onSubmit={handleCreate} className="mb-6 rounded-xl border border-blue-100 bg-white p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Weekly goal
                <select
                  required
                  value={selectedWeekGoal?.id ?? ''}
                  onChange={(event) => {
                    const nextGoal = initialWork.weekGoals.find(
                      (weekGoal) => weekGoal.id === event.target.value,
                    );
                    setWeekGoalId(event.target.value);
                    if (nextGoal) setTaskDate(nextGoal.weekStart);
                  }}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
                >
                  {initialWork.weekGoals.map((weekGoal) => (
                    <option key={weekGoal.id} value={weekGoal.id}>
                      {weekGoal.title} · {weekGoal.projectName} · {weekGoal.weekStart}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-slate-700">
                Task date
                <input
                  required
                  type="date"
                  min={selectedWeekGoal?.weekStart}
                  max={selectedWeekGoal?.weekEnd}
                  value={selectedTaskDate}
                  onChange={(event) => setTaskDate(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                />
              </label>

              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Daily task
                <input
                  required
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                  placeholder="Specific work to complete today"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                />
              </label>

              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Notes
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={2}
                  className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                />
              </label>
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={pending || !selectedWeekGoal}
              className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? 'Saving…' : 'Create Daily Task'}
            </button>
          </form>
        )}

        {error && !showForm && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              {editingId === task.id ? (
                <div>
                  <div className="grid gap-3">
                    <input
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                    <textarea
                      value={editDescription}
                      onChange={(event) => setEditDescription(event.target.value)}
                      rows={2}
                      className="resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => updateTask(task.id, { title: editTitle, description: editDescription })}
                      className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      <Check size={14} /> Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 shrink-0 text-blue-600" />
                      <h3 className="font-semibold text-slate-900">{task.title}</h3>
                    </div>
                    {task.description && <p className="mt-2 text-sm text-slate-500">{task.description}</p>}
                    <p className="mt-3 text-xs text-slate-400">
                      {task.actionTitle} → {task.projectName} → {task.weekGoalTitle}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge status={task.status} size="sm" />
                    <button
                      type="button"
                      onClick={() => beginEdit(task)}
                      aria-label={`Edit ${task.title}`}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <Pencil size={15} />
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <CalendarDays size={14} />
                  {task.taskDate}
                </div>
                <select
                  aria-label={`Status for ${task.title}`}
                  value={databaseStatus(task.status)}
                  disabled={pending}
                  onChange={(event) => updateTask(task.id, { status: event.target.value })}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                >
                  {statusOptions.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}

          {!tasks.length && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-500">
              No daily tasks have been created for this member.
            </div>
          )}
        </div>
      </section>

    </>
  );
}
