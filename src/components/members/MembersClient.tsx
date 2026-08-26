'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { ArrowRight, Pencil, Plus, ToggleLeft, ToggleRight, X } from 'lucide-react';

import type { Department, Member } from '@/types';

interface MembersClientProps {
  initialMembers: Member[];
  departments: Pick<Department, 'id' | 'name' | 'isActive'>[];
}

export default function MembersClient({ initialMembers, departments }: MembersClientProps) {
  const router = useRouter();
  const members = initialMembers;
  const [editing, setEditing] = useState<Member | null | undefined>(undefined);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [team, setTeam] = useState('');
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const departmentNames = new Map(departments.map((department) => [department.id, department.name]));

  function openForm(member: Member | null) {
    setEditing(member);
    setName(member?.name ?? '');
    setEmail(member?.email === '—' ? '' : (member?.email ?? ''));
    setRole(member?.role === '—' ? '' : (member?.role ?? ''));
    setTeam(member?.team === '—' ? '' : (member?.team ?? ''));
    setDepartmentIds(member?.departmentIds ?? (member?.departmentId ? [member.departmentId] : []));
    setError('');
  }

  function toggleDepartment(id: string) {
    setDepartmentIds((current) => current.includes(id)
      ? current.filter((departmentId) => departmentId !== id)
      : [...current, id]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const response = await fetch(editing ? `/api/members/${editing.id}` : '/api/members', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, team, departmentIds }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not save the member.');
      setEditing(undefined);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save the member.');
    } finally {
      setPending(false);
    }
  }

  async function setActive(member: Member, isActive: boolean) {
    if (!isActive && !window.confirm(`Deactivate ${member.name}? Existing assignments and history will be retained.`)) return;
    setError('');
    try {
      const response = await fetch(`/api/members/${member.id}`, {
        method: isActive ? 'PATCH' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: isActive ? JSON.stringify({ isActive: true }) : undefined,
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not update the member.');
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Could not update the member.');
    }
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Members</h1>
          <p className="mt-1 text-sm text-slate-500">Organisation members and department assignments.</p>
        </div>
        <button type="button" onClick={() => openForm(null)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"><Plus size={18} /> Add Member</button>
      </div>

      {error && editing === undefined && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              {[
  'Name',
  'Email',
  'Designation',
  'Team',
  'Department',
  'Status',
  'Actions',
].map((label) => <th key={label} className={`px-5 py-3 text-xs font-semibold uppercase text-slate-500 ${label === 'Actions' ? 'text-right' : 'text-left'}`}>{label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((member) => {
              const assignedDepartments = (member.departmentIds ?? [member.departmentId]).map((id) => departmentNames.get(id)).filter(Boolean);
              const active = member.isActive !== false;
              return (
                <tr key={member.id} className={active ? '' : 'bg-slate-50/70'}>
                  <td className="px-5 py-4 font-medium text-slate-900"><Link href={`/members/${member.id}`} className="hover:text-blue-700">{member.name}</Link></td>
                  <td className="px-5 py-4 text-sm text-slate-500">{member.email}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">{member.role}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">
  {member.team ?? '—'}
</td>
                  <td className="px-5 py-4 text-sm text-slate-600">{assignedDepartments.join(', ') || 'Unassigned'}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-5 py-4"><div className="flex items-center justify-end gap-2">
                    <Link href={`/members/${member.id}`} className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50" aria-label={`View ${member.name}`}><ArrowRight size={16} /></Link>
                    <button type="button" onClick={() => openForm(member)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label={`Edit ${member.name}`}><Pencil size={16} /></button>
                    <button type="button" onClick={() => setActive(member, !active)} className={`rounded-md p-1.5 hover:bg-slate-100 ${active ? 'text-red-500' : 'text-emerald-600'}`} aria-label={active ? `Deactivate ${member.name}` : `Reactivate ${member.name}`}>{active ? <ToggleRight size={19} /> : <ToggleLeft size={19} />}</button>
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing !== undefined && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><h2 className="font-semibold text-slate-900">{editing ? 'Edit Member' : 'Add Member'}</h2><button type="button" onClick={() => setEditing(undefined)} className="text-slate-400 hover:text-slate-700" aria-label="Close"><X size={20} /></button></div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">Name<input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
                <label className="text-sm font-medium text-slate-700">Email<input type="email" maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              </div>
              <label className="block text-sm font-medium text-slate-700">Designation<input maxLength={200} value={role} onChange={(event) => setRole(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
              <label className="block text-sm font-medium text-slate-700">
  Team
  <input
    maxLength={200}
    value={team}
    onChange={(event) => setTeam(event.target.value)}
    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
  />
</label>
              <fieldset><legend className="text-sm font-medium text-slate-700">Departments</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">
                {departments.map((department) => {
                  const checked = departmentIds.includes(department.id);
                  return <label key={department.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${checked ? 'border-blue-300 bg-blue-50' : 'border-slate-200'} ${!department.isActive ? 'text-slate-400' : 'text-slate-700'}`}><input type="checkbox" checked={checked} disabled={!department.isActive && !checked} onChange={() => toggleDepartment(department.id)} />{department.name}{!department.isActive ? ' (Inactive)' : ''}</label>;
                })}
              </div></fieldset>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
              <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={() => setEditing(undefined)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600">Cancel</button><button type="submit" disabled={pending || !departmentIds.length} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{pending ? 'Saving…' : 'Save Member'}</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
