'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Archive, Pencil, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import StatusBadge from '@/components/common/StatusBadge';
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

interface AssignmentDraft {
  keyId: string;
  subGoalId: string;
  projectId: string;
  taskId: string;
  memberId: string;
  startDate: string;
  endDate: string;
  status: string;
}

const inputClass = 'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const assignmentStatuses = [
  ['NOT_STARTED', 'Not Started'],
  ['IN_PROGRESS', 'In Progress'],
  ['DONE', 'Done'],
  ['ON_HOLD', 'On Hold'],
  ['CANCELLED', 'Cancelled'],
] as const;

function keyLabel(code: AssignmentKey['code']): string {
  return code.replace('_', ' ');
}

function databaseStatus(status: KeyAssignment['status']): string {
  return status.toUpperCase().replaceAll(' ', '_');
}

function todayInIndia(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Kolkata',
  }).format(new Date());
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
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

function SubGoalItem({ subGoal }: { subGoal: AssignmentSubGoal }) {
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

  return (
    <li className={`rounded-lg border px-3 py-3 ${subGoal.isActive ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50'}`}>
      {editing ? (
        <form onSubmit={(event) => { event.preventDefault(); void update({ title, description }); }} className="space-y-2">
          <input required aria-label="Sub goal title" value={title} maxLength={300} onChange={(event) => setTitle(event.target.value)} className={inputClass} />
          <textarea aria-label="Sub goal description" value={description} maxLength={2000} rows={2} onChange={(event) => setDescription(event.target.value)} placeholder="Optional description" className={inputClass} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-300 p-2 text-slate-600" title="Cancel edit"><X size={15} /></button>
            <button disabled={pending} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">Save</button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-slate-800">{subGoal.title}</p>
              {!subGoal.isActive && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">Archived</span>}
            </div>
            {subGoal.description && <p className="mt-1 text-xs text-slate-500">{subGoal.description}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => setEditing(true)} className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50" title="Edit sub goal"><Pencil size={15} /></button>
            <button type="button" disabled={pending} onClick={() => void update({ isActive: !subGoal.isActive })} className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50" title={subGoal.isActive ? 'Archive sub goal' : 'Restore sub goal'}>{subGoal.isActive ? <Archive size={15} /> : <RotateCcw size={15} />}</button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </li>
  );
}

function SubGoalManager({ keys }: { keys: AssignmentKey[] }) {
  const router = useRouter();
  const [addingToKeyId, setAddingToKeyId] = useState<string>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function addSubGoal(event: FormEvent<HTMLFormElement>, keyId: string) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await apiRequest('/api/sub-goals', 'POST', { keyId, title, description });
      setAddingToKeyId(undefined);
      setTitle('');
      setDescription('');
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not add the sub goal.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Keys & Sub Goals</h2>
        <p className="mt-1 text-sm text-slate-500">The three keys are fixed. Add, edit, archive, or restore their sub goals here.</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {keys.map((key) => (
          <article key={key.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-slate-900">{keyLabel(key.code)}</h3>
              <button type="button" onClick={() => { setAddingToKeyId(addingToKeyId === key.id ? undefined : key.id); setTitle(''); setDescription(''); setError(''); }} className="flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"><Plus size={14} />Add Sub Goal</button>
            </div>

            {addingToKeyId === key.id && (
              <form onSubmit={(event) => void addSubGoal(event, key.id)} className="mt-4 rounded-lg bg-blue-50/60 p-3">
                <input required value={title} maxLength={300} onChange={(event) => setTitle(event.target.value)} placeholder="Sub goal title" className={inputClass} />
                <textarea value={description} maxLength={2000} rows={2} onChange={(event) => setDescription(event.target.value)} placeholder="Optional description" className={inputClass} />
                {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
                <button disabled={pending} className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">{pending ? 'Adding...' : 'Add Sub Goal'}</button>
              </form>
            )}

            <ul className="mt-4 space-y-2">
              {key.subGoals.map((subGoal) => <SubGoalItem key={subGoal.id} subGoal={subGoal} />)}
            </ul>
            {!key.subGoals.length && <p className="mt-4 rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">No sub goals yet.</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

export default function KeysClient({ keys, assignments, projects, tasks, members }: KeysClientProps) {
  const router = useRouter();
  const activeTasks = useMemo(() => tasks.filter((task) => task.isActive), [tasks]);
  const firstKey = keys[0];
  const initialDate = todayInIndia();
  const emptyDraft = (): AssignmentDraft => ({
    keyId: firstKey?.id ?? '',
    subGoalId: firstKey?.subGoals.find((subGoal) => subGoal.isActive)?.id ?? '',
    projectId: '',
    taskId: '',
    memberId: '',
    startDate: initialDate,
    endDate: initialDate,
    status: 'NOT_STARTED',
  });
  const [draft, setDraft] = useState<AssignmentDraft>(emptyDraft);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const editingAssignment = useMemo(
    () => assignments.find((assignment) => assignment.id === editingAssignmentId),
    [assignments, editingAssignmentId],
  );

  const subGoals = useMemo(() => (
    keys.find((key) => key.id === draft.keyId)?.subGoals.filter((subGoal) => (
      subGoal.isActive || subGoal.id === editingAssignment?.subGoalId
    )) ?? []
  ), [draft.keyId, editingAssignment?.subGoalId, keys]);
  const selectedSubGoalId = subGoals.some((subGoal) => subGoal.id === draft.subGoalId)
    ? draft.subGoalId
    : subGoals[0]?.id ?? '';
  const availableProjects = useMemo(() => {
    if (!editingAssignment || projects.some((project) => project.id === editingAssignment.projectId)) return projects;
    return [{
      id: editingAssignment.projectId,
      name: `${editingAssignment.projectName} (Inactive)`,
      departmentId: editingAssignment.departmentId,
      departmentName: editingAssignment.departmentName,
    }, ...projects];
  }, [editingAssignment, projects]);
  const availableTasks = useMemo(() => {
    const currentTask = editingAssignment
      ? tasks.find((task) => task.id === editingAssignment.taskId)
      : undefined;
    return currentTask && !currentTask.isActive
      ? [{ ...currentTask, title: `${currentTask.title} (Archived)` }, ...activeTasks]
      : activeTasks;
  }, [activeTasks, editingAssignment, tasks]);
  const availableMembers = useMemo(() => {
    if (!editingAssignment || members.some((member) => member.id === editingAssignment.memberId)) return members;
    return [{ id: editingAssignment.memberId, name: `${editingAssignment.memberName} (Inactive)` }, ...members];
  }, [editingAssignment, members]);

  function updateDraft(field: keyof AssignmentDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function changeKey(keyId: string) {
    const firstSubGoal = keys.find((key) => key.id === keyId)?.subGoals.find((subGoal) => subGoal.isActive);
    setDraft((current) => ({ ...current, keyId, subGoalId: firstSubGoal?.id ?? '' }));
  }

  function resetForm() {
    setEditingAssignmentId(undefined);
    setDraft(emptyDraft());
    setError('');
  }

  function editAssignment(assignment: KeyAssignment) {
    setEditingAssignmentId(assignment.id);
    setDraft({
      keyId: assignment.keyId,
      subGoalId: assignment.subGoalId,
      projectId: assignment.projectId,
      taskId: assignment.taskId,
      memberId: assignment.memberId,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      status: databaseStatus(assignment.status),
    });
    setError('');
    setMessage('');
    document.getElementById('assignment-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function saveAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    setMessage('');
    try {
      const normalizedDraft = { ...draft, subGoalId: selectedSubGoalId };
      let payload: object = normalizedDraft;
      if (editingAssignment) {
        const original: AssignmentDraft = {
          keyId: editingAssignment.keyId,
          subGoalId: editingAssignment.subGoalId,
          projectId: editingAssignment.projectId,
          taskId: editingAssignment.taskId,
          memberId: editingAssignment.memberId,
          startDate: editingAssignment.startDate,
          endDate: editingAssignment.endDate,
          status: databaseStatus(editingAssignment.status),
        };
        payload = Object.fromEntries(
          (Object.keys(normalizedDraft) as (keyof AssignmentDraft)[])
            .filter((field) => normalizedDraft[field] !== original[field])
            .map((field) => [field, normalizedDraft[field]]),
        );
        if (!Object.keys(payload).length) {
          setMessage('No assignment changes to save.');
          return;
        }
      }
      await apiRequest(
        editingAssignmentId ? `/api/key-assignments/${editingAssignmentId}` : '/api/key-assignments',
        editingAssignmentId ? 'PATCH' : 'POST',
        payload,
      );
      const savedAsEdit = Boolean(editingAssignmentId);
      resetForm();
      setMessage(savedAsEdit ? 'Assignment updated.' : 'Assignment saved.');
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save the assignment.');
    } finally {
      setPending(false);
    }
  }

  async function deleteAssignment(id: string) {
    if (!window.confirm('Delete this assignment? This cannot be undone.')) return;
    setPending(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/api/key-assignments/${id}`, 'DELETE');
      if (editingAssignmentId === id) resetForm();
      setMessage('Assignment deleted.');
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not delete the assignment.');
    } finally {
      setPending(false);
    }
  }

  const unavailable = !editingAssignment && (!projects.length || !activeTasks.length || !members.length);

  return (
    <div className="space-y-8">
      <SubGoalManager keys={keys} />

      <section id="assignment-form" className="scroll-mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{editingAssignmentId ? 'Edit Assignment' : 'New Assignment'}</h2>
            <p className="mt-1 text-sm text-slate-500">Complete the flow in order. Only Sub Goal changes with the selected Key.</p>
          </div>
          {editingAssignmentId && <button type="button" onClick={resetForm} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><X size={15} />Cancel Edit</button>}
        </div>

        <form onSubmit={(event) => void saveAssignment(event)}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm font-medium text-slate-700"><span className="mr-1 text-blue-600">1.</span>Key<select required value={draft.keyId} onChange={(event) => changeKey(event.target.value)} className={inputClass}><option value="" disabled>Select a key</option>{keys.map((key) => <option key={key.id} value={key.id}>{keyLabel(key.code)}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700"><span className="mr-1 text-blue-600">2.</span>Sub Goal<select required value={selectedSubGoalId} onChange={(event) => updateDraft('subGoalId', event.target.value)} className={inputClass}><option value="" disabled>Select a sub goal</option>{subGoals.map((subGoal) => <option key={subGoal.id} value={subGoal.id}>{subGoal.title}{!subGoal.isActive ? ' (Archived)' : ''}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700"><span className="mr-1 text-blue-600">3.</span>Project<select required value={draft.projectId} onChange={(event) => updateDraft('projectId', event.target.value)} className={inputClass}><option value="" disabled>Select a project</option>{availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name} ({project.departmentName})</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700"><span className="mr-1 text-blue-600">4.</span>Task<select required value={draft.taskId} onChange={(event) => updateDraft('taskId', event.target.value)} className={inputClass}><option value="" disabled>Select a Task Master record</option>{availableTasks.map((task) => <option key={task.id} value={task.id}>{task.title}{task.category !== 'General' ? ` (${task.category})` : ''}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700"><span className="mr-1 text-blue-600">5.</span>Member<select required value={draft.memberId} onChange={(event) => updateDraft('memberId', event.target.value)} className={inputClass}><option value="" disabled>Select a member</option>{availableMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700"><span className="mr-1 text-blue-600">6.</span>Start Date<input required type="date" value={draft.startDate} onChange={(event) => updateDraft('startDate', event.target.value)} className={inputClass} /></label>
            <label className="text-sm font-medium text-slate-700"><span className="mr-1 text-blue-600">7.</span>End Date<input required type="date" min={draft.startDate} value={draft.endDate} onChange={(event) => updateDraft('endDate', event.target.value)} className={inputClass} /></label>
            <label className="text-sm font-medium text-slate-700"><span className="mr-1 text-blue-600">8.</span>Status<select required value={draft.status} onChange={(event) => updateDraft('status', event.target.value)} className={inputClass}>{assignmentStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <button type="submit" disabled={pending || unavailable || !selectedSubGoalId || !draft.projectId || !draft.taskId || !draft.memberId} className="mt-auto flex h-[42px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Save size={16} /><span className="text-blue-100">9.</span>{pending ? 'Saving...' : 'Save'}</button>
          </div>
        </form>

        {unavailable && <p className="mt-4 text-sm text-amber-700">At least one active project, Task Master record, and member are required.</p>}
        {error && <p className="mt-4 text-sm text-red-600" role="alert">{error}</p>}
        {message && <p className="mt-4 text-sm text-emerald-700" role="status">{message}</p>}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">All Assignments ({assignments.length})</h2>
          <p className="mt-1 text-sm text-slate-500">Every saved Work Planning assignment appears here.</p>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Key</th><th className="px-4 py-3">Sub Goal</th><th className="px-4 py-3">Project</th><th className="px-4 py-3">Task</th><th className="px-4 py-3">Member</th><th className="px-4 py-3">Start Date</th><th className="px-4 py-3">End Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">{keyLabel(assignment.keyCode)}</td>
                    <td className="px-4 py-3 text-slate-700">{assignment.subGoalTitle}</td>
                    <td className="px-4 py-3"><p className="font-medium text-slate-800">{assignment.projectName}</p><p className="text-xs text-slate-500">{assignment.departmentName}</p></td>
                    <td className="px-4 py-3"><p className="text-slate-800">{assignment.taskTitle}</p>{assignment.taskCategory !== 'General' && <p className="text-xs text-slate-500">{assignment.taskCategory}</p>}</td>
                    <td className="px-4 py-3 text-slate-700">{assignment.memberName}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(assignment.startDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(assignment.endDate)}</td>
                    <td className="px-4 py-3"><StatusBadge status={assignment.status} size="sm" /></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-2"><button type="button" onClick={() => editAssignment(assignment)} className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50" title="Edit assignment"><Pencil size={15} /></button><button type="button" disabled={pending} onClick={() => void deleteAssignment(assignment.id)} className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50" title="Delete assignment"><Trash2 size={15} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!assignments.length && <p className="p-8 text-center text-sm text-slate-500">No assignments have been saved yet.</p>}
        </div>
      </section>
    </div>
  );
}
