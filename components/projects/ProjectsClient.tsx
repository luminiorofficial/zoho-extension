'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { FolderKanban, Plus, Users } from 'lucide-react';

import ProgressBar from '@/components/common/ProgressBar';
import StatusBadge from '@/components/common/StatusBadge';
import ProjectForm from '@/components/projects/ProjectForm';
import { PROJECT_STATUSES, type MemberWorkload, type Project } from '@/types';

interface ProjectsClientProps {
  projects: Project[];
  departments: {
    id: string;
    name: string;
    goals: { id: string; title: string }[];
    members: MemberWorkload[];
  }[];
  members: { id: string; name: string }[];
  initialDepartmentId?: string;
  openCreateInitially?: boolean;
}

export default function ProjectsClient({ projects, departments, members, initialDepartmentId, openCreateInitially }: ProjectsClientProps) {
  const [showForm, setShowForm] = useState(Boolean(openCreateInitially));
  const [departmentId, setDepartmentId] = useState(initialDepartmentId ?? '');
  const [status, setStatus] = useState('');
  const [memberId, setMemberId] = useState('');

  const filteredProjects = useMemo(() => projects.filter((project) => (
    (!departmentId || project.departmentId === departmentId)
    && (!status || project.status === status)
    && (!memberId || project.memberIds.includes(memberId))
  )), [departmentId, memberId, projects, status]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-500">Manage jobs from planning through delivery and closure.</p>
        </div>
        <button type="button" onClick={() => setShowForm((current) => !current)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
          <Plus size={17} /> {showForm ? 'Hide form' : 'New project'}
        </button>
      </div>

      {showForm && <div className="mb-7"><ProjectForm departments={departments} initialDepartmentId={initialDepartmentId} onCancel={() => setShowForm(false)} /></div>}

      <div className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">Department
          <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
            <option value="">All departments</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Status
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
            <option value="">All statuses</option>
            {PROJECT_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">Member
          <select value={memberId} onChange={(event) => setMemberId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
            <option value="">All members</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
      </div>

      <p className="mb-4 text-sm text-slate-500">{filteredProjects.length} project{filteredProjects.length === 1 ? '' : 's'}</p>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filteredProjects.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`} className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-3">
                <span className="rounded-lg bg-indigo-50 p-2 text-indigo-600"><FolderKanban size={18} /></span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{project.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{project.clientName ?? 'Client not set'} · {project.jobCode ?? 'No job code'}</p>
                </div>
              </div>
              <StatusBadge status={project.status} size="sm" />
            </div>
            <p className="mt-4 text-sm text-slate-500">{project.departmentName} · {project.goalTitle}</p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Users size={14} /> {project.memberNames.length ? project.memberNames.join(', ') : 'No members assigned'}</p>
            <div className="mt-5 flex justify-between text-xs text-slate-500"><span>{project.doneTasks}/{project.totalTasks} tasks done</span><span className="font-semibold text-slate-700">{Math.round(project.progress)}%</span></div>
            <ProgressBar value={project.progress} size="sm" className="mt-2" />
          </Link>
        ))}
      </div>
      {!filteredProjects.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-500">No projects match these filters.</div>}
    </>
  );
}
