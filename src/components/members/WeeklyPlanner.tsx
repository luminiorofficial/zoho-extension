'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import GoalTaskHierarchy from '@/components/members/GoalTaskHierarchy';
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

export default function WeeklyPlanner({
  memberId,
  projects,
  weekGoals,
}: WeeklyPlannerProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [keyGoalId, setKeyGoalId] = useState('');
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const currentWeekStart = isoWeekStart(today());
  const currentWeekGoals = weekGoals.filter(
    (weekGoal) => weekGoal.weekStart === currentWeekStart,
  );

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
        }),
      });
      const body = await response.json() as { weekGoal?: { id: string }; error?: string };
      if (!response.ok || !body.weekGoal) {
        throw new Error(body.error ?? 'Could not create weekly goal.');
      }

      setTitle('');
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
            Project → Key → Weekly Goal → Tasks → Actions
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
          A department project must be created for one of this member&apos;s goals before weekly planning can begin.
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
                  <option key={project.id} value={project.id}>{project.name}</option>
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
                {!availableKeys.length && <option value="">No keys available</option>}
                {availableKeys.map((key) => (
                  <option key={key.id} value={key.id}>{key.title}</option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Weekly Goal Title
              <input
                required
                maxLength={500}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="What will be achieved this week?"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-violet-500"
              />
            </label>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={pending || !selectedKeyGoalId}
            className="mt-5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Create Goal'}
          </button>
        </form>
      )}

      {error && !showForm && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <GoalTaskHierarchy
        key={currentWeekGoals.map((goal) => goal.id).join(':')}
        weekGoals={currentWeekGoals}
        showProject
        emptyMessage="Create a goal for this week, then add its tasks and actions."
      />
    </section>
  );
}
