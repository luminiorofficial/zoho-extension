'use client';

import { FormEvent, useState } from 'react';
import { FolderKanban, Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import ProgressBar from '@/components/common/ProgressBar';
import StatusBadge from '@/components/common/StatusBadge';
import type { Project } from '@/types';

interface ProjectPanelProps {
  departmentId: string;
  goals: { id: string; title: string }[];
  initialProjects: Project[];
}

export default function ProjectPanel({
  departmentId,
  goals,
  initialProjects,
}: ProjectPanelProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [goalId, setGoalId] = useState(goals[0]?.id ?? '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId, goalId, name, description }),
      });
      const body = await response.json() as { error?: string };

      if (!response.ok) throw new Error(body.error ?? 'Could not create project.');

      setName('');
      setDescription('');
      setShowForm(false);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not create project.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Projects</h2>
          <p className="text-sm text-slate-500">
            Projects connect department goals to members’ daily work.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((current) => !current)}
          disabled={!goals.length}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {showForm ? <X size={17} /> : <Plus size={17} />}
          {showForm ? 'Cancel' : 'Add Project'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-5 grid gap-4 rounded-xl border border-blue-100 bg-blue-50/40 p-5 md:grid-cols-2"
        >
          <label className="text-sm font-medium text-slate-700">
            Department goal
            <select
              value={goalId}
              onChange={(event) => setGoalId(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
            >
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>{goal.title}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Project name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
              placeholder="Example: Q3 campaign delivery"
            />
          </label>

          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-blue-500"
            />
          </label>

          {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </form>
      )}

      {initialProjects.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {initialProjects.map((project) => (
            <div key={project.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                    <FolderKanban size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{project.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{project.goalTitle}</p>
                  </div>
                </div>
                <StatusBadge status={project.status} size="sm" />
              </div>

              {project.description && (
                <p className="mt-3 text-sm text-slate-500">{project.description}</p>
              )}

              <div className="mt-4 flex justify-between text-xs text-slate-500">
                <span>{project.doneTasks}/{project.totalTasks} tasks done</span>
                <span className="font-semibold text-slate-700">{Math.round(project.progress)}%</span>
              </div>
              <ProgressBar value={project.progress} size="sm" className="mt-2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">
          Add the first project before members create daily tasks.
        </div>
      )}
    </section>
  );
}
