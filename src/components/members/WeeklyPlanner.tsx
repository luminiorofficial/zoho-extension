'use client';

import { FormEvent, useMemo, useState } from 'react';
import { CalendarPlus, Check, Pencil, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import ProgressBar from '@/components/common/ProgressBar';
import { isoWeekStart } from '@/lib/planner-validation';
import type { Project, WeekGoal } from '@/types';

interface WeeklyPlannerProps {
  memberId: string;
  projects: Project[];
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
  weekGoals,
}: WeeklyPlannerProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [keyGoalId, setKeyGoalId] = useState('');
  const currentWeekStart = isoWeekStart(today());
  const currentWeekGoals = weekGoals.filter(
    (weekGoal) => weekGoal.weekStart === currentWeekStart,
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const selectedProject = projects.find((project) => project.id === projectId);
  const availableKeys = useMemo(
    () => selectedProject?.keys ?? [],
    [selectedProject],
  );
  const selectedKeyGoalId = availableKeys.some((key) => key.id === keyGoalId)
    ? keyGoalId
    : (availableKeys[0]?.id ?? '');

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
          keyGoalId: selectedKeyGoalId,
          weekStart: currentWeekStart,
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

  function beginEdit(weekGoal: WeekGoal) {
    setEditingId(weekGoal.id);
    setEditTitle(weekGoal.title);
    setEditDescription(weekGoal.description ?? '');
    setError('');
  }

  async function updateWeekGoal(weekGoalId: string) {
    setPending(true);
    setError('');

    try {
      const response = await fetch(`/api/week-goals/${weekGoalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, title: editTitle, description: editDescription }),
      });
      const body = await response.json() as { weekGoal?: { id: string }; error?: string };
      if (!response.ok || !body.weekGoal) {
        throw new Error(body.error ?? 'Could not update weekly goal.');
      }

      setEditingId(null);
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update weekly goal.');
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
            Commit to weekly goals for a project and key.
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
          <div className="space-y-4">
            <label className="text-sm font-medium text-slate-700">
              Project
              <select
                required
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value);
                  setKeyGoalId('');
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-violet-500"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Key
              <select
                required
                value={selectedKeyGoalId}
                onChange={(event) => setKeyGoalId(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-violet-500"
              >
                {!availableKeys.length && (
                  <option value="">No keys available</option>
                )}
                {availableKeys.map((key) => (
                  <option key={key.id} value={key.id}>
                    {key.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Weekly Goal title
              <input
                required
                maxLength={500}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What will be achieved this week?"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-violet-500"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Notes
              <textarea
                maxLength={5000}
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
            disabled={pending || !selectedKeyGoalId}
            className="mt-5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Create Weekly Goal'}
          </button>
        </form>
      )}

      {error && !showForm && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {currentWeekGoals.map((weekGoal) => (
          <div key={weekGoal.id} className="rounded-xl border border-slate-200 bg-white p-5">
            {editingId === weekGoal.id ? (
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Weekly goal
                  <input
                    required
                    maxLength={500}
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
                  />
                </label>
                <label className="mt-3 block text-xs font-medium text-slate-600">
                  Notes
                  <textarea
                    maxLength={5000}
                    rows={2}
                    value={editDescription}
                    onChange={(event) => setEditDescription(event.target.value)}
                    className="mt-1 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
                  />
                </label>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={pending || !editTitle.trim()}
                    onClick={() => void updateWeekGoal(weekGoal.id)}
                    className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                  >
                    <Check size={14} /> Save
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setEditingId(null)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-600">
                  <CalendarPlus size={14} /> {weekLabel(weekGoal.weekStart, weekGoal.weekEnd)}
                </p>
                <h3 className="mt-2 font-semibold text-slate-900">{weekGoal.title}</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">{Math.round(weekGoal.progress)}%</span>
                <button
                  type="button"
                  onClick={() => beginEdit(weekGoal)}
                  aria-label={`Edit ${weekGoal.title}`}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-violet-600"
                >
                  <Pencil size={15} />
                </button>
              </div>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {weekGoal.projectName} · {weekGoal.goalTitle}
            </p>
            {weekGoal.description && (
              <p className="mt-2 text-sm text-slate-500">{weekGoal.description}</p>
            )}
            <div className="mt-4 flex justify-between text-xs text-slate-500">
              <span>{weekGoal.doneTasks}/{weekGoal.totalTasks} daily tasks done</span>
            </div>
            <ProgressBar value={weekGoal.progress} size="sm" className="mt-2" />
              </>
            )}
          </div>
        ))}

        {!currentWeekGoals.length && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-8 text-center text-sm text-slate-500 lg:col-span-2">
            Create a goal for this week, then break it into daily tasks below.
          </div>
        )}
      </div>
    </section>
  );
}
