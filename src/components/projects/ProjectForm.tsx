'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

import CapacityBadge from '@/components/workload/CapacityBadge';
import { getCapacityStatus, MAX_ACTIVE_PROJECTS } from '@/lib/capacity';
import type { MemberWorkload } from '@/types';

interface ProjectFormDepartment {
  id: string;
  name: string;
  goals: { id: string; title: string }[];
  members: MemberWorkload[];
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
  const selectedOwnerId = department?.members.some((member) => member.memberId === ownerId)
    ? ownerId
    : (department?.members[0]?.memberId ?? '');
  const selectedMemberIds = new Set([selectedOwnerId, ...memberIds].filter(Boolean));
  const createsActiveAllocation = ['ACTIVE', 'INTERNAL_REVIEW', 'CLIENT_REVIEW', 'CLOSURE_PENDING'].includes(status);
  const assignmentWarnings = (department?.members ?? []).flatMap((member) => {
    if (!selectedMemberIds.has(member.memberId)) return [];
    const activeProjectCount = member.activeProjectCount + (createsActiveAllocation ? 1 : 0);
    const projectedStatus = getCapacityStatus({ ...member, activeProjectCount });
    const warnings: string[] = [];

    if (activeProjectCount > MAX_ACTIVE_PROJECTS) {
      warnings.push(`${member.memberName} would have ${activeProjectCount} active projects, above the recommended maximum of ${MAX_ACTIVE_PROJECTS}.`);
    }
    if (member.capacityStatus === 'Overloaded' || projectedStatus === 'Overloaded') {
      warnings.push(`${member.memberName} is ${projectedStatus.toLowerCase()} based on current and projected workload.`);
    }
    return warnings;
  });

  function toggleMember(memberId: string) {
    setMemberIds((current) => current.includes(memberId)
      ? current.filter((id) => id !== memberId)
      : [...current, memberId]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (assignmentWarnings.length && !window.confirm(`${assignmentWarnings.join('\n')}\n\nAssign anyway?`)) {
      return;
    }
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
            {department?.members.map((member) => <option key={member.memberId} value={member.memberId}>{member.memberName} · {member.capacityStatus}</option>)}
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
          <legend className="text-sm font-medium text-slate-700">Assigned members and current workload</legend>
          <p className="mt-1 text-xs text-slate-500">The owner is included automatically. Active projects count toward the three-project recommendation.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {department?.members.map((member) => {
              const selected = selectedMemberIds.has(member.memberId);
              const activeProjectCount = member.activeProjectCount + (selected && createsActiveAllocation ? 1 : 0);
              const projectedStatus = getCapacityStatus({ ...member, activeProjectCount });
              const warning = selected && (projectedStatus === 'Overloaded' || activeProjectCount > MAX_ACTIVE_PROJECTS);
              return (
                <label key={member.memberId} className={`rounded-lg border p-3 text-sm ${warning ? 'border-red-300 bg-red-50' : selected ? 'border-blue-300 bg-blue-50' : 'border-slate-200'}`}>
                  <span className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1" checked={selected} disabled={member.memberId === selectedOwnerId} onChange={() => toggleMember(member.memberId)} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium text-slate-800">{member.memberName}</span><CapacityBadge status={member.capacityStatus} /></span>
                      <span className="mt-2 block text-xs text-slate-600">{member.activeProjectCount} active projects · {member.openTaskCount} open tasks · {member.dueThisWeekTaskCount} due this week</span>
                      {selected && createsActiveAllocation && <span className="mt-2 block text-xs font-medium text-slate-700">After assignment: {activeProjectCount} active · {projectedStatus}</span>}
                      {warning && <span className="mt-2 flex gap-1.5 text-xs font-semibold text-red-700"><AlertTriangle className="shrink-0" size={14} /> Assignment needs capacity review.</span>}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      {assignmentWarnings.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={17} /> Capacity warning</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">{assignmentWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          <p className="mt-2 text-xs">This is a soft warning; Admin can confirm and continue.</p>
        </div>
      )}

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
