'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { Action, ActionStatus, Member, Priority } from '@/types';

interface ActionFormModalProps {
  goalId: string;
  members: Member[];
  action: Action | null;
  onClose: () => void;
}

function databaseStatus(status?: ActionStatus): string {
  if (status === 'In Progress') return 'IN_PROGRESS';
  if (status === 'Done') return 'DONE';
  if (status === 'On Hold') return 'ON_HOLD';
  if (status === 'Cancelled') return 'CANCELLED';
  return 'NOT_STARTED';
}

function databasePriority(priority?: Priority): string {
  return priority ? priority.toUpperCase() : '';
}

export default function ActionFormModal({ goalId, members, action, onClose }: ActionFormModalProps) {
  const router = useRouter();
  const [code, setCode] = useState(action?.code ?? '');
  const [title, setTitle] = useState(action?.title ?? '');
  const [description, setDescription] = useState(action?.description ?? '');
  const [priority, setPriority] = useState(databasePriority(action?.priority));
  const [status, setStatus] = useState(databaseStatus(action?.status));
  const [startDate, setStartDate] = useState(action?.startDate ?? '');
  const [dueDate, setDueDate] = useState(action?.dueDate ?? '');
  const [assignedMemberIds, setAssignedMemberIds] = useState(action?.assignedMemberIds ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  function toggleMember(id: string) {
    setAssignedMemberIds((current) => current.includes(id)
      ? current.filter((memberId) => memberId !== id)
      : [...current, id]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const response = await fetch(action ? `/api/actions/${action.id}` : '/api/actions', {
        method: action ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId, code, title, description, priority, status, startDate, dueDate, assignedMemberIds }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not save the action.');
      onClose();
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save the action.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4"><h2 className="font-semibold text-slate-900">{action ? 'Edit Action' : 'Add Action'}</h2><button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close"><X size={20} /></button></div>
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium text-slate-700">Code<input maxLength={100} value={code} onChange={(event) => setCode(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium text-slate-700 sm:col-span-2">Title<input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label></div>
        <label className="block text-sm font-medium text-slate-700">Description<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full resize-none rounded-lg border border-slate-300 px-3 py-2" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Status<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="NOT_STARTED">Not Started</option><option value="IN_PROGRESS">In Progress</option><option value="DONE">Done</option><option value="ON_HOLD">On Hold</option><option value="CANCELLED">Cancelled</option></select></label><label className="text-sm font-medium text-slate-700">Priority<select value={priority} onChange={(event) => setPriority(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">Not set</option><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option></select></label></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Start date<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium text-slate-700">Due date<input type="date" min={startDate || undefined} value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label></div>
        <fieldset><legend className="text-sm font-medium text-slate-700">Assigned department members</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{members.map((member) => { const checked = assignedMemberIds.includes(member.id); const inactive = member.isActive === false; return <label key={member.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${checked ? 'border-blue-300 bg-blue-50' : 'border-slate-200'} ${inactive ? 'text-slate-400' : 'text-slate-700'}`}><input type="checkbox" checked={checked} disabled={inactive && !checked} onChange={() => toggleMember(member.id)} />{member.name}{inactive ? ' (Inactive)' : ''}</label>; })}</div></fieldset>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
        <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600">Cancel</button><button type="submit" disabled={pending || !assignedMemberIds.length} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{pending ? 'Saving…' : 'Save Action'}</button></div>
      </form></div></div>
  );
}
