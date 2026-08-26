'use client';

import { FormEvent, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import DepartmentCard from './DepartmentCard';
import type { Department } from '@/types';

interface DepartmentsClientProps {
  initialDepartments: Department[];
}

export default function DepartmentsClient({ initialDepartments }: DepartmentsClientProps) {
  const router = useRouter();
  const departments = initialDepartments;
  const [editing, setEditing] = useState<Department | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  function openForm(department: Department | null) {
    setEditing(department);
    setName(department?.name ?? '');
    setDescription(department?.description ?? '');
    setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const response = await fetch(editing
        ? `/api/departments/${editing.id}`
        : '/api/departments', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not save the department.');
      setEditing(undefined);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save the department.');
    } finally {
      setPending(false);
    }
  }

  async function setActive(department: Department, isActive: boolean) {
    if (!isActive && !window.confirm(`Deactivate ${department.name}? Its imported data and history will be retained.`)) return;
    setError('');
    try {
      const response = await fetch(`/api/departments/${department.id}`, {
        method: isActive ? 'PATCH' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: isActive ? JSON.stringify({ isActive: true }) : undefined,
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not update the department.');
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Could not update the department.');
    }
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Departments</h1>
          <p className="mt-1 text-sm text-slate-500">Manage departments, their goals and tasks.</p>
        </div>
        <button type="button" onClick={() => openForm(null)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
          <Plus size={18} /> Add Department
        </button>
      </div>

      {error && editing === undefined && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>
      )}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {departments.map((department) => (
          <DepartmentCard
            key={department.id}
            department={department}
            onEdit={() => openForm(department)}
            onSetActive={(isActive) => setActive(department, isActive)}
          />
        ))}
      </div>

      {editing !== undefined && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="font-semibold text-slate-900">{editing ? 'Edit Department' : 'Add Department'}</h2>
              <button type="button" onClick={() => setEditing(undefined)} className="text-slate-400 hover:text-slate-700" aria-label="Close"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <label className="block text-sm font-medium text-slate-700">
                Department Name
                <input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Description
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="mt-1 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500" />
              </label>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditing(undefined)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600">Cancel</button>
                <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{pending ? 'Saving…' : 'Save Department'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
