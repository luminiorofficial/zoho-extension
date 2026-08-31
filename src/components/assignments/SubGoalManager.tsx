'use client';

import { FormEvent, useState } from 'react';
import { Archive, ChevronDown, Pencil, Plus, RotateCcw, Save, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { SUB_GOAL_TITLE_MAX_LENGTH } from '@/lib/planner-validation';
import type { AssignmentKey, AssignmentSubGoal } from '@/types';

const fieldClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

async function request(url: string, method: string, body: object) {
  const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? 'The request could not be completed.');
}

function SubGoalRow({ subGoal }: { subGoal: AssignmentSubGoal }) {
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
      await request(`/api/sub-goals/${subGoal.id}`, 'PATCH', body);
      setEditing(false);
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update the sub goal.');
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    return (
      <li className="border-t border-slate-100 px-4 py-3">
        <form onSubmit={(event) => { event.preventDefault(); void update({ title, description }); }} className="grid gap-2 md:grid-cols-[1fr_1.5fr_auto]">
          <input required value={title} maxLength={SUB_GOAL_TITLE_MAX_LENGTH} onChange={(event) => setTitle(event.target.value)} aria-label="Sub goal title" className={fieldClass} />
          <input value={description} maxLength={2_000} onChange={(event) => setDescription(event.target.value)} aria-label="Sub goal description" placeholder="Optional description" className={fieldClass} />
          <div className="flex gap-2"><button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-300 p-2 text-slate-500" aria-label="Cancel"><X size={16} /></button><button disabled={pending} className="rounded-lg bg-blue-600 p-2 text-white disabled:opacity-50" aria-label="Save"><Save size={16} /></button></div>
        </form>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 border-t border-slate-100 px-4 py-3">
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-700" title={subGoal.title}>{subGoal.title}</p>{subGoal.description && <p className="truncate text-xs text-slate-400" title={subGoal.description}>{subGoal.description}</p>}</div>
      {!subGoal.isActive && <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">Archived</span>}
      <button type="button" onClick={() => setEditing(true)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600" aria-label="Edit sub goal"><Pencil size={15} /></button>
      <button type="button" disabled={pending} onClick={() => void update({ isActive: !subGoal.isActive })} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50" aria-label={subGoal.isActive ? 'Archive sub goal' : 'Restore sub goal'}>{subGoal.isActive ? <Archive size={15} /> : <RotateCcw size={15} />}</button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </li>
  );
}

export default function SubGoalManager({ keys }: { keys: AssignmentKey[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | undefined>(keys[0]?.id);
  const [adding, setAdding] = useState<string>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function addSubGoal(event: FormEvent<HTMLFormElement>, keyId: string) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await request('/api/sub-goals', 'POST', { keyId, title, description });
      setAdding(undefined);
      setTitle('');
      setDescription('');
      router.refresh();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Could not add the sub goal.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4"><h3 className="font-semibold text-slate-900">Sub Goals by Key</h3><p className="mt-1 text-sm text-slate-500">Maintain the first two levels of the assignment hierarchy.</p></div>
      <div className="divide-y divide-slate-200">
        {keys.map((key) => {
          const isExpanded = expanded === key.id;
          return (
            <article key={key.id}>
              <div className="flex items-center gap-3 px-5 py-3">
                <button type="button" onClick={() => setExpanded(isExpanded ? undefined : key.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left"><ChevronDown size={16} className={`text-slate-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`} /><span className="font-semibold text-slate-800">{key.code.replace('_', ' ')}</span><span className="truncate text-sm text-slate-400">{key.title} · {key.subGoals.length} sub goals</span></button>
                <button type="button" onClick={() => { setExpanded(key.id); setAdding(adding === key.id ? undefined : key.id); setError(''); }} className="flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"><Plus size={14} />Add</button>
              </div>
              {isExpanded && (
                <div>
                  {adding === key.id && (
                    <form onSubmit={(event) => void addSubGoal(event, key.id)} className="grid gap-2 border-t border-blue-100 bg-blue-50/50 px-5 py-3 md:grid-cols-[1fr_1.5fr_auto]">
                      <input required autoFocus value={title} maxLength={SUB_GOAL_TITLE_MAX_LENGTH} onChange={(event) => setTitle(event.target.value)} placeholder="Sub goal title" className={fieldClass} />
                      <input value={description} maxLength={2_000} onChange={(event) => setDescription(event.target.value)} placeholder="Optional description" className={fieldClass} />
                      <button disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{pending ? 'Adding…' : 'Add Sub Goal'}</button>
                      {error && <p className="text-xs text-red-600 md:col-span-3">{error}</p>}
                    </form>
                  )}
                  <ul>{key.subGoals.map((subGoal) => <SubGoalRow key={subGoal.id} subGoal={subGoal} />)}{!key.subGoals.length && <li className="border-t border-slate-100 px-5 py-5 text-sm text-slate-400">No sub goals yet.</li>}</ul>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
