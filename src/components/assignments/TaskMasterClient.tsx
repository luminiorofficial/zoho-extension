'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Archive, Pencil, Plus, RotateCcw, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import type { TaskMasterItem } from '@/types';

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function TaskMasterClient({
  tasks,
  assignmentCounts,
}: {
  tasks: TaskMasterItem[];
  assignmentCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tasks.filter((task) => (showArchived || task.isActive) && (!needle || `${task.title} ${task.category}`.toLowerCase().includes(needle)));
  }, [search, showArchived, tasks]);

  async function request(url: string, method: string, body: object) {
    setPending(true); setError('');
    try {
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'Could not save the task.');
      setEditingId(undefined); router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save the task.');
    } finally { setPending(false); }
  }

  async function addTask(event: FormEvent) {
    event.preventDefault();
    await request('/api/task-master', 'POST', { title: newTitle, category: newCategory });
    setNewTitle(''); setNewCategory('');
  }

  return (
    <div className="space-y-5">
      <form onSubmit={(event) => void addTask(event)} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[minmax(14rem,2fr)_minmax(10rem,1fr)_auto]">
        <label className="text-sm font-medium text-slate-700">Task title<input required value={newTitle} maxLength={300} onChange={(event) => setNewTitle(event.target.value)} placeholder="Add an independent task" className={`mt-1.5 ${inputClass}`} /></label>
        <label className="text-sm font-medium text-slate-700">Category <span className="font-normal text-slate-400">(optional)</span><input value={newCategory} maxLength={100} onChange={(event) => setNewCategory(event.target.value)} placeholder="General" className={`mt-1.5 ${inputClass}`} /></label>
        <button disabled={pending} className="mt-auto flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"><Plus size={16} />Add Task</button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative min-w-64 flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks or categories" className={`${inputClass} pl-10`} /></label>
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />Show archived</label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Task</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Assignments</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((task) => <tr key={task.id} className={task.isActive ? '' : 'bg-slate-50'}>{editingId === task.id ? <><td className="px-4 py-3"><input required value={title} maxLength={300} onChange={(event) => setTitle(event.target.value)} className={inputClass} /></td><td className="px-4 py-3"><input value={category} maxLength={100} onChange={(event) => setCategory(event.target.value)} placeholder="General" className={inputClass} /></td><td className="px-4 py-3"><Link href={`/tasks/${task.id}`} className="font-medium text-blue-700 hover:text-blue-800">{assignmentCounts[task.id] ?? 0}</Link></td><td className="px-4 py-3 text-slate-500">{task.isActive ? 'Active' : 'Archived'}</td><td className="px-4 py-3"><div className="flex justify-end gap-2"><button type="button" disabled={pending} onClick={() => void request(`/api/task-master/${task.id}`, 'PATCH', { title, category })} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">Save</button><button type="button" onClick={() => setEditingId(undefined)} title="Cancel edit" className="rounded-lg border border-slate-300 p-2 text-slate-600"><X size={15} /></button></div></td></> : <><td className="px-4 py-3 font-medium text-slate-800">{task.title}</td><td className="px-4 py-3 text-slate-600">{task.category}</td><td className="px-4 py-3"><Link href={`/tasks/${task.id}`} className="font-medium text-blue-700 hover:text-blue-800">{assignmentCounts[task.id] ?? 0}</Link></td><td className="px-4 py-3"><span className={`text-xs font-medium ${task.isActive ? 'text-emerald-700' : 'text-slate-500'}`}>{task.isActive ? 'Active' : 'Archived'}</span></td><td className="px-4 py-3"><div className="flex justify-end gap-2"><button type="button" onClick={() => { setEditingId(task.id); setTitle(task.title); setCategory(task.category); }} title="Edit task" className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"><Pencil size={15} /></button><button type="button" disabled={pending} onClick={() => void request(`/api/task-master/${task.id}`, 'PATCH', { isActive: !task.isActive })} title={task.isActive ? 'Archive task' : 'Restore task'} className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50">{task.isActive ? <Archive size={15} /> : <RotateCcw size={15} />}</button></div></td></>}</tr>)}</tbody></table></div>
        {!filtered.length && <p className="p-8 text-center text-sm text-slate-500">No tasks match this view.</p>}
      </div>
    </div>
  );
}
