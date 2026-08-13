import Link from 'next/link';
import { FolderKanban, Plus } from 'lucide-react';

import ProgressBar from '@/components/common/ProgressBar';
import StatusBadge from '@/components/common/StatusBadge';
import type { Project } from '@/types';

interface ProjectPanelProps {
  departmentId: string;
  goals: { id: string; title: string }[];
  initialProjects: Project[];
}

export default function ProjectPanel({ departmentId, goals, initialProjects }: ProjectPanelProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Projects</h2>
          <p className="text-sm text-slate-500">Projects connect department goals to members’ daily work.</p>
        </div>
        <Link
          href={`/projects?department=${departmentId}&new=1`}
          aria-disabled={!goals.length}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 aria-disabled:pointer-events-none aria-disabled:bg-slate-300"
        >
          <Plus size={17} /> Add Project
        </Link>
      </div>

      {initialProjects.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {initialProjects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><FolderKanban size={18} /></div>
                  <div className="min-w-0"><p className="font-semibold text-slate-900">{project.name}</p><p className="mt-0.5 truncate text-xs text-slate-500">{project.goalTitle}</p></div>
                </div>
                <StatusBadge status={project.status} size="sm" />
              </div>
              {project.description && <p className="mt-3 text-sm text-slate-500">{project.description}</p>}
              <div className="mt-4 flex justify-between text-xs text-slate-500"><span>{project.doneTasks}/{project.totalTasks} tasks done</span><span className="font-semibold text-slate-700">{Math.round(project.progress)}%</span></div>
              <ProgressBar value={project.progress} size="sm" className="mt-2" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">Add the first project before members create daily tasks.</div>
      )}
    </section>
  );
}
