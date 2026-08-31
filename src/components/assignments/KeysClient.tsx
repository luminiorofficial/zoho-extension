'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ChevronDown, MoreVertical, Pencil, Plus, RotateCcw, Save, Search, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import AssignmentHierarchy from '@/components/assignments/AssignmentHierarchy';
import { SUB_GOAL_TITLE_MAX_LENGTH } from '@/lib/planner-validation';
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

async function apiRequest(url: string, method: string, body?: object) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? 'The request could not be completed.');
}

function SubGoalMenu({
  isActive,
  pending,
  onEdit,
  onToggleActive,
}: {
  isActive: boolean;
  pending: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Sub goal actions"
        aria-expanded={open}
        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <button type="button" onClick={() => { setOpen(false); onEdit(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
            <Pencil size={14} />Edit
          </button>
          <button type="button" disabled={pending} onClick={() => { setOpen(false); onToggleActive(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {isActive ? <Archive size={14} /> : <RotateCcw size={14} />}
            {isActive ? 'Archive' : 'Restore'}
          </button>
        </div>
      )}
    </div>
  );
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

  if (editing) {
    return (
      <li className="px-1 py-3">
        <form onSubmit={(event) => { event.preventDefault(); void update({ title, description }); }} className="space-y-2">
          <input required aria-label="Sub goal title" value={title} maxLength={SUB_GOAL_TITLE_MAX_LENGTH} onChange={(event) => setTitle(event.target.value)} className={inputClass} />
          <textarea aria-label="Sub goal description" value={description} maxLength={2000} rows={2} onChange={(event) => setDescription(event.target.value)} placeholder="Optional description" className={inputClass} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-300 p-2 text-slate-600" title="Cancel edit"><X size={15} /></button>
            <button disabled={pending} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">Save</button>
          </div>
        </form>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </li>
    );
  }

  return (
    <li className="flex min-h-[64px] items-center justify-between gap-3 px-1 py-3 transition-colors hover:bg-slate-50">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-slate-800">{subGoal.title}</p>
          {!subGoal.isActive && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">Archived</span>}
        </div>
        {subGoal.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{subGoal.description}</p>}
      </div>
      <SubGoalMenu
        isActive={subGoal.isActive}
        pending={pending}
        onEdit={() => setEditing(true)}
        onToggleActive={() => void update({ isActive: !subGoal.isActive })}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </li>
  );
}

function KeySection({
  keyItem,
  isExpanded,
  onToggleExpand,
  visibleSubGoals,
  totalCount,
  isSearching,
  isAdding,
  onStartAdd,
  onCancelAdd,
  addTitle,
  addDescription,
  onAddTitleChange,
  onAddDescriptionChange,
  onSubmitAdd,
  addPending,
  addError,
}: {
  keyItem: AssignmentKey;
  isExpanded: boolean;
  onToggleExpand: () => void;
  visibleSubGoals: AssignmentSubGoal[];
  totalCount: number;
  isSearching: boolean;
  isAdding: boolean;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  addTitle: string;
  addDescription: string;
  onAddTitleChange: (value: string) => void;
  onAddDescriptionChange: (value: string) => void;
  onSubmitAdd: (event: FormEvent<HTMLFormElement>) => void;
  addPending: boolean;
  addError: string;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
          <span className="min-w-0 truncate">
            <span className="font-semibold text-slate-900">{keyLabel(keyItem.code)}</span>
            <span className="ml-2 text-sm text-slate-500">· {totalCount} Sub Goal{totalCount === 1 ? '' : 's'}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onStartAdd}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50"
        >
          <Plus size={14} />Add Sub Goal
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-slate-100 px-5 py-4">
          {isAdding && (
            <form onSubmit={onSubmitAdd} className="mb-4 rounded-lg bg-blue-50/60 p-3">
              <input required autoFocus value={addTitle} maxLength={SUB_GOAL_TITLE_MAX_LENGTH} onChange={(event) => onAddTitleChange(event.target.value)} placeholder="Sub goal title" className={inputClass} />
              <textarea value={addDescription} maxLength={2000} rows={2} onChange={(event) => onAddDescriptionChange(event.target.value)} placeholder="Optional description" className={inputClass} />
              {addError && <p className="mt-2 text-xs text-red-600">{addError}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={onCancelAdd} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button disabled={addPending} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50">{addPending ? 'Adding...' : 'Add Sub Goal'}</button>
              </div>
            </form>
          )}

          {visibleSubGoals.length ? (
            <ul className="divide-y divide-slate-100">
              {visibleSubGoals.map((subGoal) => <SubGoalItem key={subGoal.id} subGoal={subGoal} />)}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500">
              {isSearching ? 'No sub goals match your search.' : 'No sub goals yet.'}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function SubGoalManager({ keys }: { keys: AssignmentKey[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [expandedKeyId, setExpandedKeyId] = useState<string | undefined>(keys[0]?.id);
  const [addingToKeyId, setAddingToKeyId] = useState<string>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const query = search.trim().toLowerCase();
  const isSearching = query.length > 0;

  function visibleSubGoals(key: AssignmentKey): AssignmentSubGoal[] {
    if (!isSearching) return key.subGoals;
    return key.subGoals.filter((subGoal) => (
      subGoal.title.toLowerCase().includes(query) || (subGoal.description ?? '').toLowerCase().includes(query)
    ));
  }

  function startAdd(keyId: string) {
    setAddingToKeyId((current) => (current === keyId ? undefined : keyId));
    setTitle('');
    setDescription('');
    setError('');
    setExpandedKeyId(keyId);
  }

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

  const noMatches = isSearching && keys.every((key) => visibleSubGoals(key).length === 0);

  return (
    <section className="mx-auto max-w-4xl">
      <div className="relative mb-5">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search sub goals..."
          aria-label="Search sub goals"
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="space-y-4">
        {keys.map((key) => {
          const matches = visibleSubGoals(key);
          const expanded = isSearching ? matches.length > 0 : expandedKeyId === key.id;
          return (
            <KeySection
              key={key.id}
              keyItem={key}
              isExpanded={expanded}
              onToggleExpand={() => setExpandedKeyId((current) => (current === key.id ? undefined : key.id))}
              visibleSubGoals={matches}
              totalCount={key.subGoals.length}
              isSearching={isSearching}
              isAdding={addingToKeyId === key.id}
              onStartAdd={() => startAdd(key.id)}
              onCancelAdd={() => setAddingToKeyId(undefined)}
              addTitle={title}
              addDescription={description}
              onAddTitleChange={setTitle}
              onAddDescriptionChange={setDescription}
              onSubmitAdd={(event) => void addSubGoal(event, key.id)}
              addPending={pending}
              addError={error}
            />
          );
        })}
      </div>

      {noMatches && (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No sub goals match &ldquo;{search.trim()}&rdquo;.
        </p>
      )}
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
        <AssignmentHierarchy
          assignments={assignments}
          emptyMessage="No assignments have been saved yet."
          highlightedAssignmentId={editingAssignmentId}
          renderDataActions={(assignment) => (
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => editAssignment(assignment)} className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50" title="Edit assignment"><Pencil size={15} /></button>
              <button type="button" disabled={pending} onClick={() => void deleteAssignment(assignment.id)} className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 disabled:opacity-50" title="Delete assignment"><Trash2 size={15} /></button>
            </div>
          )}
        />
      </section>
    </div>
  );
}
