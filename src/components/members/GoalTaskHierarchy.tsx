'use client';

import { FormEvent, MouseEvent, useState } from 'react';
import {
  Check,
  ChevronDown,
  CircleDot,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import StatusBadge from '@/components/common/StatusBadge';
import { isoWeekStart } from '@/lib/planner-validation';
import type { ActionStatus, DailyTask, TaskAction, WeekGoal } from '@/types';

interface GoalTaskHierarchyProps {
  weekGoals: WeekGoal[];
  emptyMessage?: string;
  showProject?: boolean;
  showMember?: boolean;
}

const statusOptions: { label: ActionStatus; value: string }[] = [
  { label: 'Not Started', value: 'NOT_STARTED' },
  { label: 'Started', value: 'STARTED' },
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
  if (status === 'Started') return 'STARTED';
  return 'NOT_STARTED';
}

export default function GoalTaskHierarchy({
  weekGoals,
  emptyMessage = 'No weekly goals have been created yet.',
  showProject = false,
  showMember = false,
}: GoalTaskHierarchyProps) {
  const router = useRouter();
  const [goals, setGoals] = useState(weekGoals);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [taskGoalId, setTaskGoalId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [actionTaskId, setActionTaskId] = useState<string | null>(null);
  const [actionTitle, setActionTitle] = useState('');
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editGoalTitle, setEditGoalTitle] = useState('');
  const [editGoalDescription, setEditGoalDescription] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDate, setEditTaskDate] = useState('');
  const [editTaskStatus, setEditTaskStatus] = useState('NOT_STARTED');
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [editActionTitle, setEditActionTitle] = useState('');

  const currentWeekStart = isoWeekStart(today());

  function beginGoalEdit(event: MouseEvent, goal: WeekGoal) {
    event.preventDefault();
    event.stopPropagation();
    setEditingGoalId(goal.id);
    setEditGoalTitle(goal.title);
    setEditGoalDescription(goal.description ?? '');
    setError('');
  }

  async function saveGoal(goal: WeekGoal) {
    setPending(true);
    setError('');

    try {
      const response = await fetch(`/api/week-goals/${goal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: goal.assignedMemberId,
          title: editGoalTitle,
          description: editGoalDescription,
        }),
      });
      const body = await response.json() as { weekGoal?: { id: string }; error?: string };
      if (!response.ok || !body.weekGoal) {
        throw new Error(body.error ?? 'Could not update the weekly goal.');
      }

      setGoals((current) => current.map((item) => (
        item.id === goal.id
          ? { ...item, title: editGoalTitle.trim(), description: editGoalDescription.trim() || undefined }
          : item
      )));
      setEditingGoalId(null);
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update the weekly goal.');
    } finally {
      setPending(false);
    }
  }

  async function deleteGoal(event: MouseEvent, goal: WeekGoal) {
    event.preventDefault();
    event.stopPropagation();

    const taskCount = Math.max(goal.totalTasks, goal.tasks.length);
    const message = taskCount > 0
      ? `Delete “${goal.title}”? It contains ${taskCount} task${taskCount === 1 ? '' : 's'}. All of those tasks and their task actions will also be permanently deleted.`
      : `Delete “${goal.title}”? This weekly goal will be permanently deleted.`;
    if (!window.confirm(message)) return;

    setPending(true);
    setError('');

    try {
      const response = await fetch(`/api/week-goals/${goal.id}`, { method: 'DELETE' });
      const body = await response.json() as { deletedWeekGoalId?: string; error?: string };
      if (!response.ok || !body.deletedWeekGoalId) {
        throw new Error(body.error ?? 'Could not delete the weekly goal.');
      }

      setGoals((current) => current.filter((item) => item.id !== goal.id));
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the weekly goal.');
    } finally {
      setPending(false);
    }
  }

  async function createTask(event: FormEvent<HTMLFormElement>, goal: WeekGoal) {
    event.preventDefault();
    setPending(true);
    setError('');

    const currentDate = today();
    const taskDate = currentDate < goal.weekStart
      ? goal.weekStart
      : currentDate > goal.weekEnd
        ? goal.weekEnd
        : currentDate;

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: goal.assignedMemberId,
          weekGoalId: goal.id,
          title: taskTitle,
          taskDate,
        }),
      });
      const body = await response.json() as { task?: DailyTask; error?: string };
      if (!response.ok || !body.task) {
        throw new Error(body.error ?? 'Could not create the task.');
      }

      const createdTask = { ...body.task, actions: body.task.actions ?? [] };
      setGoals((current) => current.map((item) => (
        item.id === goal.id
          ? { ...item, totalTasks: item.totalTasks + 1, tasks: [...item.tasks, createdTask] }
          : item
      )));
      setTaskTitle('');
      setTaskGoalId(null);
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create the task.');
    } finally {
      setPending(false);
    }
  }

  async function updateTaskStatus(task: DailyTask, status: string) {
    setPending(true);
    setError('');

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const body = await response.json() as { task?: DailyTask; error?: string };
      if (!response.ok || !body.task) {
        throw new Error(body.error ?? 'Could not update task status.');
      }

      setGoals((current) => current.map((goal) => ({
        ...goal,
        tasks: goal.tasks.map((item) => (
          item.id === task.id
            ? { ...body.task as DailyTask, actions: body.task?.actions ?? item.actions }
            : item
        )),
      })));
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update task status.');
    } finally {
      setPending(false);
    }
  }

  function beginTaskEdit(task: DailyTask) {
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title);
    setEditTaskDate(task.taskDate);
    setEditTaskStatus(databaseStatus(task.status));
    setError('');
  }

  async function saveTask(task: DailyTask) {
    setPending(true);
    setError('');

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTaskTitle,
          taskDate: editTaskDate,
          status: editTaskStatus,
        }),
      });
      const body = await response.json() as { task?: DailyTask; error?: string };
      if (!response.ok || !body.task) {
        throw new Error(body.error ?? 'Could not update the task.');
      }

      setGoals((current) => current.map((goal) => ({
        ...goal,
        tasks: goal.tasks.map((item) => (
          item.id === task.id
            ? { ...body.task as DailyTask, actions: body.task?.actions ?? item.actions }
            : item
        )),
      })));
      setEditingTaskId(null);
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update the task.');
    } finally {
      setPending(false);
    }
  }

  async function deleteTask(task: DailyTask) {
    const actionWarning = task.actions.length > 0
      ? ` Its ${task.actions.length} task action${task.actions.length === 1 ? '' : 's'} will also be permanently deleted.`
      : '';
    if (!window.confirm(`Delete task “${task.title}”?${actionWarning}`)) return;

    setPending(true);
    setError('');

    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
      const body = await response.json() as { deletedTaskId?: string; error?: string };
      if (!response.ok || !body.deletedTaskId) {
        throw new Error(body.error ?? 'Could not delete the task.');
      }

      setGoals((current) => current.map((goal) => (
        goal.tasks.some((item) => item.id === task.id)
          ? {
              ...goal,
              totalTasks: Math.max(0, goal.totalTasks - 1),
              doneTasks: Math.max(0, goal.doneTasks - (task.status === 'Done' ? 1 : 0)),
              tasks: goal.tasks.filter((item) => item.id !== task.id),
            }
          : goal
      )));
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the task.');
    } finally {
      setPending(false);
    }
  }

  async function createAction(event: FormEvent<HTMLFormElement>, task: DailyTask) {
    event.preventDefault();
    setPending(true);
    setError('');

    try {
      const response = await fetch('/api/task-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, title: actionTitle }),
      });
      const body = await response.json() as { taskAction?: TaskAction; error?: string };
      if (!response.ok || !body.taskAction) {
        throw new Error(body.error ?? 'Could not create the action.');
      }

      setGoals((current) => current.map((goal) => ({
        ...goal,
        tasks: goal.tasks.map((item) => (
          item.id === task.id
            ? { ...item, actions: [...item.actions, body.taskAction as TaskAction] }
            : item
        )),
      })));
      setActionTitle('');
      setActionTaskId(null);
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create the action.');
    } finally {
      setPending(false);
    }
  }

  async function updateAction(action: TaskAction, changes: { title?: string; status?: string }) {
    setPending(true);
    setError('');

    try {
      const response = await fetch(`/api/task-actions/${action.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      const body = await response.json() as { taskAction?: TaskAction; error?: string };
      if (!response.ok || !body.taskAction) {
        throw new Error(body.error ?? 'Could not update the task action.');
      }

      setGoals((current) => current.map((goal) => ({
        ...goal,
        tasks: goal.tasks.map((task) => ({
          ...task,
          actions: task.actions.map((item) => (
            item.id === action.id ? body.taskAction as TaskAction : item
          )),
        })),
      })));
      setEditingActionId(null);
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update the task action.');
    } finally {
      setPending(false);
    }
  }

  async function deleteAction(action: TaskAction) {
    if (!window.confirm(`Delete task action “${action.title}”?`)) return;

    setPending(true);
    setError('');

    try {
      const response = await fetch(`/api/task-actions/${action.id}`, { method: 'DELETE' });
      const body = await response.json() as { deletedTaskActionId?: string; error?: string };
      if (!response.ok || !body.deletedTaskActionId) {
        throw new Error(body.error ?? 'Could not delete the task action.');
      }

      setGoals((current) => current.map((goal) => ({
        ...goal,
        tasks: goal.tasks.map((task) => ({
          ...task,
          actions: task.actions.filter((item) => item.id !== action.id),
        })),
      })));
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the task action.');
    } finally {
      setPending(false);
    }
  }

  if (!goals.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-8 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {goals.map((goal) => {
        const isCurrentWeek = goal.weekStart === currentWeekStart;

        return (
          <details
            key={goal.id}
            open
            className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                  Weekly Goal
                </p>
                <h3 className="mt-1 font-semibold text-slate-900">{goal.title}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {showProject && `${goal.projectName} · `}{goal.goalTitle}
                  {showMember && ` · ${goal.assignedMemberName}`}
                  {' · '}{goal.weekStart} to {goal.weekEnd}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {isCurrentWeek && (
                  <>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={(event) => beginGoalEdit(event, goal)}
                      aria-label={`Edit ${goal.title}`}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-violet-600 disabled:opacity-50"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={(event) => void deleteGoal(event, goal)}
                      aria-label={`Delete ${goal.title}`}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
                <ChevronDown className="mt-1 h-5 w-5 text-slate-400 transition group-open:rotate-180" />
              </div>
            </summary>

            <div className="border-t border-slate-100 p-4">
              {editingGoalId === goal.id && (
                <div className="mb-4 rounded-lg border border-violet-100 bg-violet-50/40 p-3">
                  <label className="block text-xs font-medium text-slate-600">
                    Weekly Goal title
                    <input
                      required
                      maxLength={500}
                      value={editGoalTitle}
                      onChange={(event) => setEditGoalTitle(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500"
                    />
                  </label>
                  <label className="mt-3 block text-xs font-medium text-slate-600">
                    Legacy notes
                    <textarea
                      maxLength={5000}
                      rows={2}
                      value={editGoalDescription}
                      onChange={(event) => setEditGoalDescription(event.target.value)}
                      className="mt-1 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500"
                    />
                  </label>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={pending || !editGoalTitle.trim()}
                      onClick={() => void saveGoal(goal)}
                      className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                    >
                      <Check size={14} /> Save
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setEditingGoalId(null)}
                      className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
                    >
                      <X size={14} /> Cancel
                    </button>
                  </div>
                </div>
              )}

              {goal.description && editingGoalId !== goal.id && (
                <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Legacy note: {goal.description}
                </p>
              )}

              {isCurrentWeek && (
                <div className="mb-4">
                  {taskGoalId === goal.id ? (
                    <form onSubmit={(event) => void createTask(event, goal)} className="flex flex-col gap-2 sm:flex-row">
                      <input
                        autoFocus
                        required
                        maxLength={500}
                        value={taskTitle}
                        onChange={(event) => setTaskTitle(event.target.value)}
                        placeholder="Task title"
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      />
                      <button
                        type="submit"
                        disabled={pending || !taskTitle.trim()}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                      >
                        Create Task
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setTaskGoalId(null)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setTaskGoalId(goal.id);
                        setTaskTitle('');
                        setError('');
                      }}
                      className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                      <Plus size={16} /> Add Task
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-3 border-l-2 border-slate-100 pl-4">
                {goal.tasks.map((task) => (
                  <div key={task.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-medium text-slate-800">
                          <ListChecks size={16} className="shrink-0 text-blue-600" />
                          {task.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">{task.taskDate}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={task.status} size="sm" />
                        {isCurrentWeek && (
                          <>
                            <select
                              aria-label={`Status for ${task.title}`}
                              value={databaseStatus(task.status)}
                              disabled={pending}
                              onChange={(event) => void updateTaskStatus(task, event.target.value)}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-blue-500"
                            >
                              {statusOptions.map((status) => (
                                <option key={status.value} value={status.value}>{status.label}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => beginTaskEdit(task)}
                              aria-label={`Edit ${task.title}`}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-blue-600 disabled:opacity-50"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => void deleteTask(task)}
                              aria-label={`Delete ${task.title}`}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {editingTaskId === task.id && (
                      <div className="mt-3 grid gap-2 rounded-lg border border-blue-100 bg-blue-50/50 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <label className="text-xs font-medium text-slate-600">
                          Task title
                          <input
                            autoFocus
                            required
                            maxLength={500}
                            value={editTaskTitle}
                            onChange={(event) => setEditTaskTitle(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                          />
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          Date
                          <input
                            type="date"
                            required
                            min={goal.weekStart}
                            max={goal.weekEnd}
                            value={editTaskDate}
                            onChange={(event) => setEditTaskDate(event.target.value)}
                            className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                          />
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          Status
                          <select
                            value={editTaskStatus}
                            onChange={(event) => setEditTaskStatus(event.target.value)}
                            className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                          >
                            {statusOptions.map((status) => (
                              <option key={status.value} value={status.value}>{status.label}</option>
                            ))}
                          </select>
                        </label>
                        <div className="flex gap-2 sm:col-span-3">
                          <button
                            type="button"
                            disabled={pending || !editTaskTitle.trim() || !editTaskDate}
                            onClick={() => void saveTask(task)}
                            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                          >
                            <Check size={14} /> Save
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setEditingTaskId(null)}
                            className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
                          >
                            <X size={14} /> Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 border-l border-slate-200 pl-4">
                      {isCurrentWeek && actionTaskId !== task.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setActionTaskId(task.id);
                            setActionTitle('');
                            setError('');
                          }}
                          className="mb-2 flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700"
                        >
                          <Plus size={14} /> Add Action
                        </button>
                      )}

                      {actionTaskId === task.id && (
                        <form onSubmit={(event) => void createAction(event, task)} className="mb-3 flex flex-col gap-2 sm:flex-row">
                          <input
                            autoFocus
                            required
                            maxLength={1000}
                            value={actionTitle}
                            onChange={(event) => setActionTitle(event.target.value)}
                            placeholder="Action"
                            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-violet-500"
                          />
                          <button
                            type="submit"
                            disabled={pending || !actionTitle.trim()}
                            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setActionTaskId(null)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-600"
                          >
                            Cancel
                          </button>
                        </form>
                      )}

                      <div className="space-y-1.5">
                        {task.actions.map((action) => (
                          <div key={action.id} className="rounded-lg border border-slate-100 bg-white p-2">
                            {editingActionId === action.id ? (
                              <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                  autoFocus
                                  required
                                  maxLength={1000}
                                  value={editActionTitle}
                                  onChange={(event) => setEditActionTitle(event.target.value)}
                                  aria-label={`Title for ${action.title}`}
                                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-violet-500"
                                />
                                <button
                                  type="button"
                                  disabled={pending || !editActionTitle.trim()}
                                  onClick={() => void updateAction(action, { title: editActionTitle })}
                                  className="flex items-center justify-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                                >
                                  <Check size={14} /> Save
                                </button>
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => setEditingActionId(null)}
                                  className="flex items-center justify-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600"
                                >
                                  <X size={14} /> Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                                <p className="flex min-w-0 items-start gap-2 text-sm text-slate-600">
                                  <CircleDot size={13} className="mt-1 shrink-0 text-violet-400" />
                                  <span className="break-words">{action.title}</span>
                                </p>
                                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                                  <StatusBadge status={action.status} size="sm" />
                                  {isCurrentWeek && (
                                    <>
                                      <select
                                        aria-label={`Status for ${action.title}`}
                                        value={databaseStatus(action.status)}
                                        disabled={pending}
                                        onChange={(event) => void updateAction(action, { status: event.target.value })}
                                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 outline-none focus:border-violet-500"
                                      >
                                        {statusOptions.map((status) => (
                                          <option key={status.value} value={status.value}>{status.label}</option>
                                        ))}
                                      </select>
                                      <button
                                        type="button"
                                        disabled={pending}
                                        onClick={() => {
                                          setEditingActionId(action.id);
                                          setEditActionTitle(action.title);
                                          setError('');
                                        }}
                                        aria-label={`Edit ${action.title}`}
                                        className="rounded-md p-1.5 text-slate-400 hover:bg-violet-50 hover:text-violet-600 disabled:opacity-50"
                                      >
                                        <Pencil size={13} />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={pending}
                                        onClick={() => void deleteAction(action)}
                                        aria-label={`Delete ${action.title}`}
                                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {!task.actions.length && (
                          <p className="text-xs text-slate-400">No actions yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {!goal.tasks.length && (
                  <p className="py-2 text-sm text-slate-400">No tasks yet.</p>
                )}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
