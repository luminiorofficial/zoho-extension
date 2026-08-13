'use client';

import { FormEvent, useMemo, useState } from 'react';
import { CalendarPlus, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import ProgressBar from '@/components/common/ProgressBar';
import { isoWeekStart } from '@/lib/planner-validation';
import type { Project, WeekGoal, WorkActionOption } from '@/types';

interface WeeklyPlannerProps {
  memberId: string;
  projects: Project[];
  actions: WorkActionOption[];
  weekGoals: WeekGoal[];
}

function today(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function weekLabel(start: string, end: string): string {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${formatter.format(new Date(`${start}T00:00:00Z`))} – ${formatter.format(new Date(`${end}T00:00:00Z`))}`;
}

export default function WeeklyPlanner({
  memberId,
  projects,
  actions,
  weekGoals,
}: WeeklyPlannerProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [actionId, setActionId] = useState('');
  const [weekStart, setWeekStart] = useState(isoWeekStart(today()));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const selectedProject = projects.find((project) => project.id === projectId);
  const compatibleActions = useMemo(
    () => actions.filter((action) => action.goalId === selectedProject?.goalId),
    [actions, selectedProject?.goalId],
  );
  const selectedActionId = compatibleActions.some((action) => action.id === actionId)
    ? actionId
    : (compatibleActions[0]?.id ?? '');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');

    try {
      const response = await fetch('/api/week-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          projectId,
          actionId: selectedActionId,
          weekStart,
          title,
          description,
        }),
      });
      const body = await response.json() as { weekGoal?: { id: string }; error?: string };
      if (!response.ok || !body.weekGoal) {
        throw new Error(body.error ?? 'Could not create weekly goal.');
      }

      setTitle('');
      setDescription('');
      setShowForm(false);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not create weekly goal.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Weekly Planner</h2>
          <p className="mt-1 text-sm text-slate-500">
            Commit to weekly goals linked to your assigned actions and projects.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((current) => !current)}
          disabled={!projects.length}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {showForm ? <X size={17} /> : <Plus size={17} />}
          {showForm ? 'Cancel' : 'Add Weekly Goal'}
        </button>
      </div>

      {!projects.length && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          A department project must be created for one of this member’s goals before weekly planning can begin.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-violet-100 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Project
              <select
                required
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  setActionId('');
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-violet-500"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} · {project.goalTitle}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Assigned action
              <select
                required
                value={selectedActionId}
                onChange={(event) => setActionId(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-violet-500"
              >
                {compatibleActions.map((action) => (
                  <option key={action.id} value={action.id}>
                    {action.code ? `${action.code} · ` : ''}{action.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Week containing
              <input
                required
                type="date"
                value={weekStart}
                onChange={(event) => setWeekStart(isoWeekStart(event.target.value))}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-violet-500"
              />
              <span className="mt-1 block text-xs font-normal text-slate-400">Stored as Monday–Sunday.</span>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Weekly goal
              <input
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What will be achieved this week?"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-violet-500"
              />
            </label>

            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              Notes
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
                className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-violet-500"
              />
            </label>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={pending || !selectedActionId}
            className="mt-5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Create Weekly Goal'}
          </button>
        </form>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {weekGoals.map((weekGoal) => (
          <div key={weekGoal.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-600">
                  <CalendarPlus size={14} /> {weekLabel(weekGoal.weekStart, weekGoal.weekEnd)}
                </p>
                <h3 className="mt-2 font-semibold text-slate-900">{weekGoal.title}</h3>
              </div>
              <span className="text-sm font-semibold text-slate-700">{Math.round(weekGoal.progress)}%</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {weekGoal.actionTitle} · {weekGoal.projectName}
            </p>
            {weekGoal.description && (
              <p className="mt-2 text-sm text-slate-500">{weekGoal.description}</p>
            )}
            <div className="mt-4 flex justify-between text-xs text-slate-500">
              <span>{weekGoal.doneTasks}/{weekGoal.totalTasks} daily tasks done</span>
            </div>
            <ProgressBar value={weekGoal.progress} size="sm" className="mt-2" />
          </div>
        ))}

        {!weekGoals.length && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-8 text-center text-sm text-slate-500 lg:col-span-2">
            Create a weekly goal, then break it into daily tasks below.
          </div>
        )}
      </div>
    </section>
  );
}
