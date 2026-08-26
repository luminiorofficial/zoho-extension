'use client';

import { FormEvent, useState } from 'react';
import {
  CalendarCheck2,
  CalendarDays,
  Check,
  ClipboardList,
  Forward,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import PeriodProgressCards from '@/components/common/PeriodProgressCards';
import StatusBadge from '@/components/common/StatusBadge';
import WeeklyPlanner from '@/components/members/WeeklyPlanner';
import { isoWeekStart } from '@/lib/planner-validation';
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

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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
  const [editTaskDate, setEditTaskDate] = useState('');
  const [carryMessage, setCarryMessage] = useState('');

  const currentDate = today();
  const currentWeekStart = isoWeekStart(currentDate);
  const currentWeekEnd = addDays(currentWeekStart, 4);
  const previousWeekStart = addDays(currentWeekStart, -7);
  const previousWeekEnd = addDays(previousWeekStart, 6);
  const currentWeekGoals = initialWork.weekGoals.filter(
    (weekGoal) => weekGoal.weekStart === currentWeekStart,
  );
  const currentWeekTasks = tasks.filter(
    (task) => task.taskDate >= currentWeekStart && task.taskDate <= currentWeekEnd,
  );
  const todayTasks = currentWeekTasks.filter((task) => task.taskDate === currentDate);
  const unfinishedPreviousWeekTasks = tasks.filter((task) => (
    task.taskDate >= previousWeekStart
    && task.taskDate <= previousWeekEnd
    && task.status !== 'Done'
    && !task.carriedForward
  ));
  const workWeekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(
    (label, index) => ({ label, date: addDays(currentWeekStart, index) }),
  );

  const selectedWeekGoal = currentWeekGoals.find((weekGoal) => weekGoal.id === weekGoalId)
    ?? currentWeekGoals[0];
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

  async function deleteTask(task: DailyTask) {
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return;

    setPending(true);
    setError('');

    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
      const body = await response.json() as { deletedTaskId?: string; error?: string };
      if (!response.ok || body.deletedTaskId !== task.id) {
        throw new Error(body.error ?? 'Could not delete task.');
      }

      setTasks((current) => current.filter((item) => item.id !== task.id));
      if (editingId === task.id) setEditingId(null);
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete task.');
    } finally {
      setPending(false);
    }
  }

  async function carryForward() {
    setPending(true);
    setError('');
    setCarryMessage('');

    try {
      const response = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId: member.id, sourceWeekStart: previousWeekStart }),
      });
      const body = await response.json() as {
        carriedTaskCount?: number;
        skippedTaskCount?: number;
        error?: string;
      };
      if (!response.ok || body.carriedTaskCount === undefined) {
        throw new Error(body.error ?? 'Could not carry unfinished tasks forward.');
      }

      const skipped = body.skippedTaskCount ?? 0;
      setCarryMessage(
        `${body.carriedTaskCount} unfinished task${body.carriedTaskCount === 1 ? '' : 's'} carried into this week${skipped ? `; ${skipped} inactive assignment${skipped === 1 ? ' was' : 's were'} skipped` : ''}.`,
      );
      router.refresh();
    } catch (carryError) {
      setError(carryError instanceof Error ? carryError.message : 'Could not carry tasks forward.');
    } finally {
      setPending(false);
    }
  }

  function beginEdit(task: DailyTask) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description ?? '');
    setEditTaskDate(task.taskDate);
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
              Department → Goal → Action → Project → Member → Week Goal → Daily Task
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowForm((current) => !current)}
            disabled={!currentWeekGoals.length}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {showForm ? <X size={17} /> : <Plus size={17} />}
            {showForm ? 'Cancel' : 'Add Daily Task'}
          </button>
        </div>

        {!currentWeekGoals.length && (
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Create a goal for the current week before adding daily tasks.
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
                  {currentWeekGoals.map((weekGoal) => (
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
                  maxLength={500}
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                  placeholder="Specific work to complete today"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                />
              </label>

              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Notes
                <textarea
                  maxLength={5000}
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

        {(unfinishedPreviousWeekTasks.length > 0 || carryMessage) && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-100 bg-violet-50/60 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Carry forward unfinished work</p>
              <p className="mt-1 text-xs text-slate-500">
                {carryMessage || `${unfinishedPreviousWeekTasks.length} unfinished task${unfinishedPreviousWeekTasks.length === 1 ? '' : 's'} from ${previousWeekStart}–${previousWeekEnd}.`}
              </p>
            </div>
            {unfinishedPreviousWeekTasks.length > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => void carryForward()}
                className="flex items-center gap-2 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
              >
                <Forward size={16} /> Carry into this week
              </button>
            )}
          </div>
        )}

        <div className="mb-7 rounded-xl border border-blue-100 bg-blue-50/50 p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 font-semibold text-slate-900">
              <CalendarCheck2 className="h-5 w-5 text-blue-600" /> Today&apos;s Tasks
            </h3>
            <span className="text-xs font-medium text-slate-500">{currentDate}</span>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {todayTasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-blue-100 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{task.title}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {task.weekGoalTitle} · {task.projectName}
                    </p>
                  </div>
                  <StatusBadge status={task.status} size="sm" />
                </div>
                <select
                  aria-label={`Status for today's task ${task.title}`}
                  value={databaseStatus(task.status)}
                  disabled={pending}
                  onChange={(event) => updateTask(task.id, { status: event.target.value })}
                  className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                >
                  {statusOptions.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
            ))}

            {!todayTasks.length && (
              <p className="text-sm text-slate-500 lg:col-span-2">No tasks are scheduled for today.</p>
            )}
          </div>
        </div>

        <div className="mb-7">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-900">Monday–Friday Plan</h3>
            <span className="text-xs text-slate-500">{currentWeekStart} to {currentWeekEnd}</span>
          </div>
          <div className="grid gap-3 xl:grid-cols-5">
            {workWeekDays.map((day) => {
              const dayTasks = currentWeekTasks.filter((task) => task.taskDate === day.date);
              const isToday = day.date === currentDate;

              return (
                <div
                  key={day.date}
                  className={`min-h-44 rounded-xl border p-3 ${isToday ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 bg-white'}`}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-blue-700' : 'text-slate-600'}`}>
                        {day.label}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">{day.date}</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">
                      {dayTasks.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {dayTasks.map((task) => (
                      <div key={task.id} className="rounded-lg border border-slate-100 bg-white p-2.5 shadow-sm">
                        <p className="text-xs font-medium text-slate-800">{task.title}</p>
                        <p className="mt-1 truncate text-[11px] text-slate-400">{task.weekGoalTitle}</p>
                        <select
                          aria-label={`Status for ${task.title} on ${day.label}`}
                          value={databaseStatus(task.status)}
                          disabled={pending}
                          onChange={(event) => updateTask(task.id, { status: event.target.value })}
                          className="mt-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 outline-none focus:border-blue-500"
                        >
                          {statusOptions.map((status) => (
                            <option key={status.value} value={status.value}>{status.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                    {!dayTasks.length && <p className="py-4 text-center text-xs text-slate-400">No tasks</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-semibold text-slate-900">Task Details</h3>
          <span className="text-xs text-slate-500">
            {currentWeekStart} to {currentWeekEnd} · {currentWeekTasks.length} task{currentWeekTasks.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="space-y-3">
          {currentWeekTasks.map((task) => {
            const taskWeekGoal = currentWeekGoals.find((weekGoal) => weekGoal.id === task.weekGoalId);

            return (
              <div key={task.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                {editingId === task.id ? (
                  <div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-xs font-medium text-slate-600 md:col-span-2">
                        Task
                        <input
                          required
                          maxLength={500}
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-600">
                        Task date
                        <input
                          required
                          type="date"
                          min={taskWeekGoal?.weekStart}
                          max={taskWeekGoal?.weekEnd}
                          value={editTaskDate}
                          onChange={(event) => setEditTaskDate(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-600 md:col-span-2">
                        Notes
                        <textarea
                          maxLength={5000}
                          value={editDescription}
                          onChange={(event) => setEditDescription(event.target.value)}
                          rows={2}
                          className="mt-1 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={pending || !editTitle.trim()}
                        onClick={() => updateTask(task.id, {
                          title: editTitle,
                          description: editDescription,
                          taskDate: editTaskDate,
                        })}
                        className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
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
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => deleteTask(task)}
                        aria-label={`Delete ${task.title}`}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={15} />
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
            );
          })}

          {!currentWeekTasks.length && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-500">
              No daily tasks have been created for the current week.
            </div>
          )}
        </div>
      </section>

    </>
  );
}
