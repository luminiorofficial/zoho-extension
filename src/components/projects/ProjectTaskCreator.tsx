'use client';

import {
  FormEvent,
  useState,
} from 'react';

import {
  Plus,
  X,
} from 'lucide-react';

import { useRouter } from 'next/navigation';

import {
  addDays,
  isoWeekStart,
} from '@/lib/planner-validation';

interface ProjectTaskMember {
  id: string;
  name: string;
}

interface ProjectTaskCreatorProps {
  projectId: string;
  projectName: string;
  members: ProjectTaskMember[];
}

function today(): string {
  const now = new Date();

  const local =
    new Date(
      now.getTime()
      - now.getTimezoneOffset()
        * 60_000,
    );

  return local
    .toISOString()
    .slice(0, 10);
}

export default function ProjectTaskCreator({
  projectId,
  projectName,
  members,
}: ProjectTaskCreatorProps) {
  const router = useRouter();

  const currentDate = today();

  const currentWeekStart =
    isoWeekStart(currentDate);

  const currentWeekFriday =
    addDays(
      currentWeekStart,
      4,
    );

  const defaultTaskDate =
    currentDate > currentWeekFriday
      ? currentWeekFriday
      : currentDate;

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    memberId,
    setMemberId,
  ] = useState(
    members[0]?.id ?? '',
  );

  const [
    title,
    setTitle,
  ] = useState('');

  const [
    description,
    setDescription,
  ] = useState('');

  const [
    taskDate,
    setTaskDate,
  ] = useState(
    defaultTaskDate,
  );

  const [
    pending,
    setPending,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  const [
    success,
    setSuccess,
  ] = useState('');

  function toggleForm() {
    setShowForm(
      (current) => !current,
    );

    setError('');
    setSuccess('');
  }

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!memberId) {
      setError(
        'Select a project member.',
      );
      return;
    }

    if (!title.trim()) {
      setError(
        'Enter a task name.',
      );
      return;
    }

    setPending(true);
    setError('');
    setSuccess('');

    try {
      const response =
        await fetch(
          `/api/projects/${projectId}/tasks`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                memberId,
                title,
                description,
                taskDate,
              }),
          },
        );

      const body =
        await response.json() as {
          error?: string;
          task?: {
            id: string;
          };
        };

      if (
        !response.ok
        || !body.task
      ) {
        throw new Error(
          body.error
          ?? 'Could not create task.',
        );
      }

      setTitle('');
      setDescription('');

      setSuccess(
        'Task added successfully.',
      );

      setShowForm(false);

      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Could not create task.',
      );
    } finally {
      setPending(false);
    }
  }

  if (!members.length) {
    return (
      <div className="text-right">
        <button
          type="button"
          disabled
          className="flex cursor-not-allowed items-center gap-2 rounded-lg bg-slate-300 px-4 py-2.5 text-sm font-medium text-white"
        >
          <Plus size={17} />
          Add Task
        </button>

        <p className="mt-1 text-xs text-amber-600">
          Assign a member to
          this project first.
        </p>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={toggleForm}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
      >
        {showForm ? (
          <X size={17} />
        ) : (
          <Plus size={17} />
        )}

        {showForm
          ? 'Cancel'
          : 'Add Task'}
      </button>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">

            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Add Task
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {projectName}
                </p>
              </div>

              <button
                type="button"
                onClick={toggleForm}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={
                handleSubmit
              }
              className="space-y-5 p-6"
            >
              <label className="block text-sm font-medium text-slate-700">
                Task name

                <input
                  required
                  maxLength={500}
                  value={title}
                  onChange={(
                    event,
                  ) =>
                    setTitle(
                      event.target
                        .value,
                    )
                  }
                  placeholder="What needs to be done?"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Assign to

                <select
                  required
                  value={memberId}
                  onChange={(
                    event,
                  ) =>
                    setMemberId(
                      event.target
                        .value,
                    )
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">
                    Select project member
                  </option>

                  {members.map(
                    (member) => (
                      <option
                        key={
                          member.id
                        }
                        value={
                          member.id
                        }
                      >
                        {
                          member.name
                        }
                      </option>
                    ),
                  )}
                </select>

                <span className="mt-1 block text-xs font-normal text-slate-400">
                  Only members assigned
                  to this project are
                  shown.
                </span>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Task date

                <input
                  required
                  type="date"
                  min={
                    currentWeekStart
                  }
                  max={
                    currentWeekFriday
                  }
                  value={taskDate}
                  onChange={(
                    event,
                  ) =>
                    setTaskDate(
                      event.target
                        .value,
                    )
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                <span className="mt-1 block text-xs font-normal text-slate-400">
                  Current week,
                  Monday–Friday.
                </span>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Description

                <textarea
                  rows={4}
                  maxLength={5000}
                  value={
                    description
                  }
                  onChange={(
                    event,
                  ) =>
                    setDescription(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Optional task details..."
                  className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={
                    toggleForm
                  }
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    pending
                    || !memberId
                    || !title.trim()
                  }
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending
                    ? 'Creating…'
                    : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {success && (
        <p className="mt-2 text-xs font-medium text-emerald-600">
          {success}
        </p>
      )}
    </>
  );
}