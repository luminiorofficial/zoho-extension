'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, CheckCircle2, Circle, ClipboardCheck, Pencil, Users, X } from 'lucide-react';

import ProgressBar from '@/components/common/ProgressBar';
import StatusBadge from '@/components/common/StatusBadge';
import { PROJECT_STATUSES, type ProjectDetail } from '@/types';
import { PROJECT_STATUS_VALUES } from '@/lib/project-constants';

interface ProjectDetailClientProps {
  project: ProjectDetail;
  departmentMembers: { id: string; name: string }[];
}

const fieldClass = 'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5';

function formatDate(value?: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

function formatBudget(value?: number): string {
  if (value === undefined) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
}

export default function ProjectDetailClient({ project, departmentMembers }: ProjectDetailClientProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [clientName, setClientName] = useState(project.clientName ?? '');
  const [name, setName] = useState(project.name);
  const [jobCode, setJobCode] = useState(project.jobCode ?? '');
  const [description, setDescription] = useState(project.description ?? '');
  const [ownerId, setOwnerId] = useState(project.ownerId ?? departmentMembers[0]?.id ?? '');
  const [memberIds, setMemberIds] = useState(project.memberIds);
  const [startDate, setStartDate] = useState(project.startDate ?? '');
  const [deadline, setDeadline] = useState(project.deadline ?? '');
  const [status, setStatus] = useState(project.status);
  const [budget, setBudget] = useState(String(project.budget ?? 0));
  const [pending, setPending] = useState(false);
  const [pendingClosureId, setPendingClosureId] = useState('');
  const [error, setError] = useState('');

  const completedClosure = project.closureItems.filter((item) => item.completed).length;
  const allClosureComplete = project.closureItems.every((item) => !item.required || item.completed);

  function toggleMember(memberId: string) {
    if (memberId === ownerId) return;
    setMemberIds((current) => current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]);
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName, name, jobCode, description, ownerId,
          memberIds: [...new Set([ownerId, ...memberIds])],
          startDate, deadline, status: PROJECT_STATUS_VALUES[status], budget,
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not update project.');
      setEditing(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update project.');
    } finally {
      setPending(false);
    }
  }

  async function updateClosure(itemId: string, changes: { assignedMemberId?: string | null; completed?: boolean }) {
    setPendingClosureId(itemId);
    setError('');
    try {
      const response = await fetch(`/api/projects/${project.id}/closure/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not update checklist.');
      router.refresh();
    } catch (closureError) {
      setError(closureError instanceof Error ? closureError.message : 'Could not update checklist.');
    } finally {
      setPendingClosureId('');
    }
  }

  return (
    <>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/projects" className="text-sm font-medium text-blue-600 hover:text-blue-700">← All projects</Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{project.clientName ?? 'Client not set'} · {project.jobCode ?? 'No job code'}</p>
        </div>
        <button type="button" onClick={() => setEditing((current) => !current)} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          {editing ? <X size={17} /> : <Pencil size={17} />} {editing ? 'Cancel edit' : 'Edit project'}
        </button>
      </div>

      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      {editing ? (
        <form onSubmit={saveProject} className="mb-7 rounded-xl border border-blue-100 bg-white p-6 shadow-sm">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">Client name<input required value={clientName} onChange={(event) => setClientName(event.target.value)} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700">Project / Job name<input required value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700">Job code<input required value={jobCode} onChange={(event) => setJobCode(event.target.value)} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700">Owner<select value={ownerId} onChange={(event) => { setOwnerId(event.target.value); setMemberIds((current) => [...new Set([...current, event.target.value])]); }} className={fieldClass}>{departmentMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Start date<input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700">Deadline<input required type="date" min={startDate} value={deadline} onChange={(event) => setDeadline(event.target.value)} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700">Status<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className={fieldClass}>{PROJECT_STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Budget (INR)<input required type="number" min="0" step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3">Description<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className={`${fieldClass} resize-none`} /></label>
            <fieldset className="md:col-span-2 xl:col-span-3">
              <legend className="text-sm font-medium text-slate-700">Assigned members</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{departmentMembers.map((member) => <label key={member.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" checked={memberIds.includes(member.id) || member.id === ownerId} disabled={member.id === ownerId} onChange={() => toggleMember(member.id)} />{member.name}</label>)}</div>
            </fieldset>
          </div>
          {status === 'Closed' && !allClosureComplete && <p className="mt-4 text-sm text-amber-700">Closed will be rejected until all required closure items are completed.</p>}
          <button type="submit" disabled={pending} className="mt-6 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">{pending ? 'Saving…' : 'Save changes'}</button>
        </form>
      ) : (
        <section className="mb-7 rounded-xl border border-slate-200 bg-white p-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Department</p><p className="mt-1 text-sm font-medium text-slate-800">{project.departmentName}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Goal</p><p className="mt-1 text-sm font-medium text-slate-800">{project.goalTitle}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Owner</p><p className="mt-1 text-sm font-medium text-slate-800">{project.ownerName ?? '—'}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Budget</p><p className="mt-1 text-sm font-medium text-slate-800">{formatBudget(project.budget)}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Start</p><p className="mt-1 text-sm font-medium text-slate-800">{formatDate(project.startDate)}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Deadline</p><p className="mt-1 text-sm font-medium text-slate-800">{formatDate(project.deadline)}</p></div>
            <div className="sm:col-span-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Description</p><p className="mt-1 text-sm text-slate-700">{project.description ?? '—'}</p></div>
          </div>
        </section>
      )}

      <div className="mb-7 grid gap-5 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
          <div className="flex items-center justify-between gap-4"><div><h2 className="font-semibold text-slate-900">Overall project progress</h2><p className="mt-1 text-sm text-slate-500">Calculated automatically from linked daily tasks.</p></div><span className="text-3xl font-bold text-slate-900">{Math.round(project.progress)}%</span></div>
          <ProgressBar value={project.progress} className="mt-5" />
          <div className="mt-3 flex gap-5 text-sm text-slate-500"><span>{project.totalTasks} total tasks</span><span>{project.doneTasks} completed</span></div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900"><Users size={18} /> Assigned members</h2>
          <div className="mt-4 space-y-2">{project.memberIds.map((id, index) => <Link key={id} href={`/members/${id}`} className="block rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-blue-700">{project.memberNames[index]}</Link>)}</div>
          {!project.memberIds.length && <p className="mt-3 text-sm text-slate-500">No members assigned.</p>}
        </section>
      </div>

      <section className="mb-7 rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-semibold text-slate-900"><ClipboardCheck size={19} /> Job Closure checklist</h2><p className="mt-1 text-sm text-slate-500">Assign every deliverable, then complete all required items before closing.</p></div><span className="text-sm font-semibold text-slate-700">{completedClosure}/{project.closureItems.length} complete</span></div>
        <ProgressBar value={project.closureItems.length ? completedClosure / project.closureItems.length * 100 : 0} size="sm" className="mt-4" />
        <div className="mt-5 divide-y divide-slate-100">{project.closureItems.map((item) => (
          <div key={item.id} className="grid gap-3 py-4 md:grid-cols-[1fr_240px_auto] md:items-center">
            <div className="flex items-center gap-3">{item.completed ? <CheckCircle2 className="text-emerald-500" size={20} /> : <Circle className="text-slate-300" size={20} />}<div><p className="text-sm font-medium text-slate-800">{item.label}</p>{item.required && <p className="text-xs text-slate-400">Required</p>}</div></div>
            <select aria-label={`Assignee for ${item.label}`} value={item.assignedMemberId ?? ''} disabled={pendingClosureId === item.id || project.status === 'Closed'} onChange={(event) => updateClosure(item.id, { assignedMemberId: event.target.value || null })} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Unassigned</option>{project.memberIds.map((id, index) => <option key={id} value={id}>{project.memberNames[index]}</option>)}</select>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={item.completed} disabled={pendingClosureId === item.id || !item.assignedMemberId || project.status === 'Closed'} onChange={(event) => updateClosure(item.id, { completed: event.target.checked })} />Complete</label>
          </div>
        ))}</div>
      </section>

      <div className="grid gap-7 xl:grid-cols-2">
        <section><h2 className="mb-4 font-semibold text-slate-900">Linked actions</h2><div className="space-y-3">{project.actions.map((action) => <div key={action.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex justify-between gap-3"><p className="text-sm font-medium text-slate-800">{action.code ? `${action.code} · ` : ''}{action.title}</p><span className="text-sm font-semibold">{Math.round(action.progress)}%</span></div><ProgressBar value={action.progress} size="sm" className="mt-3" /></div>)}{!project.actions.length && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No actions are linked through weekly goals yet.</p>}</div></section>
        <section><h2 className="mb-4 font-semibold text-slate-900">Linked weekly goals</h2><div className="space-y-3">{project.weekGoals.map((weekGoal) => <div key={weekGoal.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex justify-between gap-3"><div><p className="text-sm font-medium text-slate-800">{weekGoal.title}</p><p className="mt-1 text-xs text-slate-500">{weekGoal.assignedMemberName} · {formatDate(weekGoal.weekStart)}–{formatDate(weekGoal.weekEnd)}</p></div><span className="text-sm font-semibold">{Math.round(weekGoal.progress)}%</span></div><ProgressBar value={weekGoal.progress} size="sm" className="mt-3" /></div>)}{!project.weekGoals.length && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No weekly goals linked yet.</p>}</div></section>
      </div>

      <section className="mt-7"><h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900"><CalendarDays size={18} /> Daily tasks and task progress</h2><div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Task</th><th className="px-4 py-3">Action / Week goal</th><th className="px-4 py-3">Member</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{project.tasks.map((task) => <tr key={task.id}><td className="px-4 py-3 font-medium text-slate-800">{task.title}</td><td className="px-4 py-3 text-slate-500">{task.actionTitle}<br /><span className="text-xs">{task.weekGoalTitle}</span></td><td className="px-4 py-3 text-slate-600">{project.memberNames[project.memberIds.indexOf(task.assignedMemberId)] ?? '—'}</td><td className="px-4 py-3 text-slate-600">{formatDate(task.taskDate)}</td><td className="px-4 py-3"><StatusBadge status={task.status} size="sm" /></td></tr>)}</tbody></table></div>{!project.tasks.length && <p className="p-8 text-center text-sm text-slate-500">No daily tasks linked yet.</p>}</div></section>
    </>
  );
}
