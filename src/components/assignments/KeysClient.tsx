'use client';

import { FormEvent, useState } from 'react';
import { Archive, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import StatusBadge from '@/components/common/StatusBadge';
import AssignmentFormModal from '@/components/assignments/AssignmentFormModal';
import type {
  AssignableMember,
  AssignableProject,
  AssignmentKey,
  AssignmentSubGoal,
  KeyAssignment,
  TaskMasterItem,
} from '@/types';

interface KeysClientProps {
  keys: AssignmentKey[];
  assignments: KeyAssignment[];
  projects: AssignableProject[];
  tasks: TaskMasterItem[];
  members: AssignableMember[];
}

interface ModalState {
  keyId: string;
  subGoalId: string;
  assignment?: KeyAssignment;
}

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

async function apiRequest(url: string, method: string, body?: object) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? 'The request could not be completed.');
}

function SubGoalRow({
  subGoal,
  assignments,
  onAddAssignment,
  onEditAssignment,
}: {
  subGoal: AssignmentSubGoal;
  assignments: KeyAssignment[];
  onAddAssignment: () => void;
  onEditAssignment: (assignment: KeyAssignment) => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(subGoal.title);
  const [description, setDescription] = useState(subGoal.description ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function update(body: object) {
    setPending(true);
    setError('');
    try {
      await apiRequest(`/api/sub-goals/${subGoal.id}`, 'PATCH', body);
      setEditing(false);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update the sub goal.');
    } finally {
      setPending(false);
    }
  }

  async function removeAssignment(id: string) {
    if (!window.confirm('Delete this assignment? This cannot be undone.')) return;
    setPending(true);
    setError('');
    try {
      await apiRequest(`/api/key-assignments/${id}`, 'DELETE');
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not delete the assignment.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`border-t border-slate-200 px-5 py-5 ${subGoal.isActive ? '' : 'bg-slate-50'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        {editing ? (
          <form onSubmit={(event) => { event.preventDefault(); void update({ title, description }); }} className="grid flex-1 gap-3 md:grid-cols-[minmax(12rem,1fr)_minmax(16rem,2fr)_auto]">
            <input required value={title} maxLength={300} onChange={(event) => setTitle(event.target.value)} aria-label="Sub goal title" className={inputClass} />
            <input value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} aria-label="Sub goal description" placeholder="Optional description" className={inputClass} />
            <div className="flex gap-2"><button disabled={pending} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Save</button><button type="button" onClick={() => setEditing(false)} title="Cancel edit" className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"><X size={17} /></button></div>
          </form>
        ) : (
          <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="font-medium text-slate-900">{subGoal.title}</h3>{!subGoal.isActive && <span className="text-xs font-medium text-slate-500">Archived</span>}</div>{subGoal.description && <p className="mt-1 text-sm text-slate-500">{subGoal.description}</p>}</div>
        )}

        {!editing && <div className="flex items-center gap-2">
          {subGoal.isActive && <button type="button" onClick={onAddAssignment} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"><Plus size={15} />Add Assignment</button>}
          <button type="button" onClick={() => setEditing(true)} title="Edit sub goal" className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"><Pencil size={16} /></button>
          <button type="button" disabled={pending} onClick={() => void update({ isActive: !subGoal.isActive })} title={subGoal.isActive ? 'Archive sub goal' : 'Restore sub goal'} className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50">{subGoal.isActive ? <Archive size={16} /> : <RotateCcw size={16} />}</button>
        </div>}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 overflow-x-auto">
        {assignments.length ? <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Project</th><th className="px-3 py-2">Task</th><th className="px-3 py-2">Member</th><th className="px-3 py-2">Dates</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-slate-100">{assignments.map((assignment) => <tr key={assignment.id}><td className="px-3 py-3"><p className="font-medium text-slate-800">{assignment.projectName}</p><p className="text-xs text-slate-500">{assignment.departmentName}</p></td><td className="px-3 py-3"><p className="text-slate-800">{assignment.taskTitle}</p>{assignment.taskCategory !== 'General' && <p className="text-xs text-slate-500">{assignment.taskCategory}</p>}</td><td className="px-3 py-3 text-slate-700">{assignment.memberName}</td><td className="px-3 py-3 text-slate-600">{formatDate(assignment.startDate)}<br /><span className="text-xs">to {formatDate(assignment.endDate)}</span></td><td className="px-3 py-3"><StatusBadge status={assignment.status} size="sm" /></td><td className="px-3 py-3"><div className="flex justify-end gap-2"><button type="button" onClick={() => onEditAssignment(assignment)} title="Edit assignment" className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"><Pencil size={15} /></button><button type="button" disabled={pending} onClick={() => void removeAssignment(assignment.id)} title="Delete assignment" className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table> : <p className="py-3 text-sm text-slate-500">No assignments saved for this sub goal.</p>}
      </div>
    </div>
  );
}

export default function KeysClient({ keys, assignments, projects, tasks, members }: KeysClientProps) {
  const router = useRouter();
  const [editingKeyId, setEditingKeyId] = useState<string>();
  const [keyTitle, setKeyTitle] = useState('');
  const [addingToKeyId, setAddingToKeyId] = useState<string>();
  const [subGoalTitle, setSubGoalTitle] = useState('');
  const [subGoalDescription, setSubGoalDescription] = useState('');
  const [modal, setModal] = useState<ModalState>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function saveKey(event: FormEvent, keyId: string) {
    event.preventDefault();
    setPending(true); setError('');
    try { await apiRequest(`/api/keys/${keyId}`, 'PATCH', { title: keyTitle }); setEditingKeyId(undefined); router.refresh(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not update the key.'); }
    finally { setPending(false); }
  }

  async function addSubGoal(event: FormEvent, keyId: string) {
    event.preventDefault();
    setPending(true); setError('');
    try { await apiRequest('/api/sub-goals', 'POST', { keyId, title: subGoalTitle, description: subGoalDescription }); setAddingToKeyId(undefined); setSubGoalTitle(''); setSubGoalDescription(''); router.refresh(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Could not add the sub goal.'); }
    finally { setPending(false); }
  }

  return (
    <>
      <div className="space-y-6">
        {keys.map((key) => <section key={key.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase text-blue-600">{key.code.replace('_', ' ')}</p>
              {editingKeyId === key.id ? <form onSubmit={(event) => void saveKey(event, key.id)} className="mt-1 flex max-w-xl gap-2"><input required value={keyTitle} maxLength={200} onChange={(event) => setKeyTitle(event.target.value)} className={inputClass} /><button disabled={pending} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Save</button><button type="button" onClick={() => setEditingKeyId(undefined)} title="Cancel edit" className="rounded-lg border border-slate-300 p-2 text-slate-600"><X size={17} /></button></form> : <div className="mt-1 flex items-center gap-2"><h2 className="text-lg font-semibold text-slate-900">{key.title}</h2><button type="button" onClick={() => { setEditingKeyId(key.id); setKeyTitle(key.title); }} title="Edit key title" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><Pencil size={15} /></button></div>}
            </div>
            <button type="button" onClick={() => setAddingToKeyId(addingToKeyId === key.id ? undefined : key.id)} className="flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"><Plus size={15} />Add Sub Goal</button>
          </div>

          {addingToKeyId === key.id && <form onSubmit={(event) => void addSubGoal(event, key.id)} className="grid gap-3 border-t border-slate-200 bg-blue-50/40 px-5 py-4 md:grid-cols-[minmax(12rem,1fr)_minmax(16rem,2fr)_auto]"><input required value={subGoalTitle} maxLength={300} onChange={(event) => setSubGoalTitle(event.target.value)} placeholder="Sub goal title" className={inputClass} /><input value={subGoalDescription} maxLength={2000} onChange={(event) => setSubGoalDescription(event.target.value)} placeholder="Optional description" className={inputClass} /><button disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Add Sub Goal</button></form>}
          {key.subGoals.map((subGoal) => <SubGoalRow key={subGoal.id} subGoal={subGoal} assignments={assignments.filter((assignment) => assignment.subGoalId === subGoal.id)} onAddAssignment={() => setModal({ keyId: key.id, subGoalId: subGoal.id })} onEditAssignment={(assignment) => setModal({ keyId: assignment.keyId, subGoalId: assignment.subGoalId, assignment })} />)}
          {!key.subGoals.length && <p className="border-t border-slate-200 px-5 py-8 text-center text-sm text-slate-500">No sub goals yet. Add one to start assigning work.</p>}
        </section>)}
      </div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {modal && <AssignmentFormModal keys={keys} projects={projects} tasks={tasks} members={members} initialKeyId={modal.keyId} initialSubGoalId={modal.subGoalId} assignment={modal.assignment} onClose={() => setModal(undefined)} />}
    </>
  );
}
