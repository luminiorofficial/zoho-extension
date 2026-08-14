'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

import type { ActionStatus, Goal, Member } from '@/types';

interface GoalFormModalProps {
  departmentId: string;
  members: Member[];
  goal: Goal | null;
  onClose: () => void;
}

function databaseStatus(status?: ActionStatus): string {
  if (status === 'In Progress') return 'IN_PROGRESS';
  if (status === 'Done') return 'DONE';
  if (status === 'On Hold') return 'ON_HOLD';
  if (status === 'Cancelled') return 'CANCELLED';
  return 'NOT_STARTED';
}

export default function GoalFormModal({ departmentId, members, goal, onClose }: GoalFormModalProps) {
  const router = useRouter();
  const selectableMembers = members.filter((member) => member.isActive !== false || member.id === goal?.ownerMemberId);
  const [ownerMemberId, setOwnerMemberId] = useState(goal?.ownerMemberId ?? selectableMembers[0]?.id ?? '');
  const [code, setCode] = useState(goal?.code ?? '');
  const [title, setTitle] = useState(goal?.title ?? '');
  const [description, setDescription] = useState(goal?.description ?? '');
  const [status, setStatus] = useState(databaseStatus(goal?.status));
  const [startDate, setStartDate] = useState(goal?.startDate ?? '');
  const [endDate, setEndDate] = useState(goal?.endDate ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const response = await fetch(goal ? `/api/goals/${goal.id}` : '/api/goals', {
        method: goal ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId, ownerMemberId, code, title, description, status, startDate, endDate }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not save the goal.');
      onClose();
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save the goal.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4"><h2 className="font-semibold text-slate-900">{goal ? 'Edit Goal' : 'Add Goal'}</h2><button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close"><X size={20} /></button></div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Goal code<input maxLength={100} value={code} onChange={(event) => setCode(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-medium text-slate-700">Owner<select required value={ownerMemberId} onChange={(event) => setOwnerMemberId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">Select owner</option>{selectableMembers.map((member) => <option key={member.id} value={member.id} disabled={member.isActive === false}>{member.name}{member.isActive === false ? ' (Inactive)' : ''}</option>)}</select></label>
          </div>
          <label className="block text-sm font-medium text-slate-700">Title<input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="block text-sm font-medium text-slate-700">Description<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full resize-none rounded-lg border border-slate-300 px-3 py-2" /></label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">Status<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="NOT_STARTED">Not Started</option><option value="IN_PROGRESS">In Progress</option><option value="DONE">Done</option><option value="ON_HOLD">On Hold</option><option value="CANCELLED">Cancelled</option></select></label>
            <label className="text-sm font-medium text-slate-700">Start date<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
            <label className="text-sm font-medium text-slate-700">End date<input type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
          <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600">Cancel</button><button type="submit" disabled={pending || !ownerMemberId} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{pending ? 'Saving…' : 'Save Goal'}</button></div>
        </form>
      </div>
    </div>
  );
}
