'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ProjectFormDepartment {
  id: string;
  name: string;
  goals: { id: string; title: string }[];
  members: { id: string; name: string }[];
}

interface ProjectFormProps {
  departments: ProjectFormDepartment[];
  initialDepartmentId?: string;
  onCancel?: () => void;
}

function localDate(): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

export default function ProjectForm({
  departments,
  initialDepartmentId,
  onCancel,
}: ProjectFormProps) {
  const router = useRouter();
  const fallbackDepartmentId = departments.some((item) => item.id === initialDepartmentId)
    ? initialDepartmentId!
    : (departments[0]?.id ?? '');
  const [departmentId, setDepartmentId] = useState(fallbackDepartmentId);
  const [goalId, setGoalId] = useState('');
  const [clientName, setClientName] = useState('');
  const [name, setName] = useState('');
  const [jobCode, setJobCode] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(localDate());
  const [deadline, setDeadline] = useState('');
  const [status, setStatus] = useState('PLANNED');
  const [budget, setBudget] = useState('0');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const department = useMemo(
    () => departments.find((item) => item.id === departmentId),
    [departmentId, departments],
  );
  const selectedGoalId = department?.goals.some((goal) => goal.id === goalId)
    ? goalId
    : (department?.goals[0]?.id ?? '');
  const selectedOwnerId = department?.members.some((member) => member.id === ownerId)
    ? ownerId
    : (department?.members[0]?.id ?? '');

  function toggleMember(memberId: string) {
    setMemberIds((current) => current.includes(memberId)
      ? current.filter((id) => id !== memberId)
      : [...current, memberId]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId,
          goalId: selectedGoalId,
          clientName,
          name,
          jobCode,
          description,
          ownerId: selectedOwnerId,
          memberIds,
          startDate,
          deadline,
          status,
          budget,
        }),
      });
      const body = await response.json() as { project?: { id: string }; error?: string };
      if (!response.ok || !body.project) throw new Error(body.error ?? 'Could not create project.');
      router.push(`/projects/${body.project.id}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not create project.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-blue-100 bg-white p-6 shadow-sm">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">
          Department
          <select
            required
            value={departmentId}
            onChange={(event) => {
              setDepartmentId(event.target.value);
              setGoalId('');
              setOwnerId('');
              setMemberIds([]);
            }}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
          >
            {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Department goal
          <select
            required
            value={selectedGoalId}
            onChange={(event) => setGoalId(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
          >
            {department?.goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Client name
          <input required value={clientName} onChange={(event) => setClientName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Project / Job name
          <input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Job code
          <input required value={jobCode} onChange={(event) => setJobCode(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Owner
          <select required value={selectedOwnerId} onChange={(event) => setOwnerId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
            {department?.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Start date
          <input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Deadline
          <input required type="date" min={startDate} value={deadline} onChange={(event) => setDeadline(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
        </label>

        <label className="text-sm font-medium text-slate-700">
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
            <option value="PLANNED">Planned</option>
            <option value="ACTIVE">Active</option>
            <option value="INTERNAL_REVIEW">Internal Review</option>
            <option value="CLIENT_REVIEW">Client Review</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CLOSURE_PENDING">Closure Pending</option>
          </select>
        </label>

        <label className="text-sm font-medium text-slate-700">
          Budget (INR)
          <input required type="number" min="0" step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
        </label>

        <label className="text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3">
          Description
          <textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 px-3 py-2.5" />
        </label>

        <fieldset className="md:col-span-2 xl:col-span-3">
          <legend className="text-sm font-medium text-slate-700">Assigned members</legend>
          <p className="mt-1 text-xs text-slate-500">The owner is included automatically.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {department?.members.map((member) => (
              <label key={member.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <input type="checkbox" checked={memberIds.includes(member.id) || member.id === selectedOwnerId} disabled={member.id === selectedOwnerId} onChange={() => toggleMember(member.id)} />
                {member.name}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {(!department?.goals.length || !department.members.length) && (
        <p className="mt-4 text-sm text-amber-700">This department needs at least one goal and member before a project can be created.</p>
      )}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex gap-3">
        <button type="submit" disabled={pending || !selectedGoalId || !selectedOwnerId} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {pending ? 'Creating…' : 'Create Project'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700">Cancel</button>}
      </div>
    </form>
  );
}
