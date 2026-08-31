'use client';

import { FormEvent, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { ASSIGNMENT_STATUS_OPTIONS, assignmentStatusCode } from '@/lib/assignment-status';
import { todayInIndia } from '@/lib/assignment-tracker-periods';
import type {
  AssignableMember,
  AssignableProject,
  AssignmentKey,
  KeyAssignment,
  TaskMasterItem,
} from '@/types';

interface AssignmentFormModalProps {
  keys: AssignmentKey[];
  projects: AssignableProject[];
  tasks: TaskMasterItem[];
  members: AssignableMember[];
  initialKeyId: string;
  initialSubGoalId: string;
  assignment?: KeyAssignment;
  onClose: () => void;
}

const fieldClass = 'mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export default function AssignmentFormModal({
  keys,
  projects,
  tasks,
  members,
  initialKeyId,
  initialSubGoalId,
  assignment,
  onClose,
}: AssignmentFormModalProps) {
  const router = useRouter();
  const [keyId, setKeyId] = useState(assignment?.keyId ?? initialKeyId);
  const [subGoalId, setSubGoalId] = useState(assignment?.subGoalId ?? initialSubGoalId);
  const [projectId, setProjectId] = useState(assignment?.projectId ?? projects[0]?.id ?? '');
  const [taskId, setTaskId] = useState(assignment?.taskId ?? tasks.find((task) => task.isActive)?.id ?? '');
  const [memberId, setMemberId] = useState(assignment?.memberId ?? members[0]?.id ?? '');
  const [startDate, setStartDate] = useState(assignment?.startDate ?? todayInIndia());
  const [endDate, setEndDate] = useState(assignment?.endDate ?? todayInIndia());
  const [status, setStatus] = useState(assignment ? assignmentStatusCode(assignment.status) : 'NOT_STARTED');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const subGoals = useMemo(
    () => keys.find((key) => key.id === keyId)?.subGoals.filter((subGoal) => (
      subGoal.isActive || subGoal.id === assignment?.subGoalId
    )) ?? [],
    [assignment?.subGoalId, keyId, keys],
  );

  function changeKey(nextKeyId: string) {
    setKeyId(nextKeyId);
    const firstSubGoal = keys.find((key) => key.id === nextKeyId)?.subGoals.find((item) => item.isActive);
    setSubGoalId(firstSubGoal?.id ?? '');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const response = await fetch(
        assignment ? `/api/key-assignments/${assignment.id}` : '/api/key-assignments',
        {
          method: assignment ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keyId,
            subGoalId,
            projectId,
            taskId,
            memberId,
            startDate,
            endDate,
            status,
          }),
        },
      );
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not save the assignment.');
      onClose();
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the assignment.');
    } finally {
      setPending(false);
    }
  }

  const activeTasks = tasks.filter((task) => task.isActive || task.id === assignment?.taskId);
  const availableProjects = assignment && !projects.some((project) => project.id === assignment.projectId)
    ? [{ id: assignment.projectId, name: `${assignment.projectName} (Inactive)`, departmentId: assignment.departmentId, departmentName: assignment.departmentName }, ...projects]
    : projects;
  const availableMembers = assignment && !members.some((member) => member.id === assignment.memberId)
    ? [{ id: assignment.memberId, name: `${assignment.memberName} (Inactive)` }, ...members]
    : members;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label={assignment ? 'Edit assignment' : 'Add assignment'}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-semibold text-slate-900">{assignment ? 'Edit Assignment' : 'Add Assignment'}</h2>
            <p className="mt-0.5 text-sm text-slate-500">Assign any active project, independent task, and active member.</p>
          </div>
          <button type="button" onClick={onClose} title="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><X size={19} /></button>
        </div>

        <form onSubmit={(event) => void submit(event)} className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Key<select required value={keyId} onChange={(event) => changeKey(event.target.value)} className={fieldClass}>{keys.map((key) => <option key={key.id} value={key.id}>{key.code.replace('_', ' ')}: {key.title}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Sub Goal<select required value={subGoalId} onChange={(event) => setSubGoalId(event.target.value)} className={fieldClass}><option value="" disabled>Select a sub goal</option>{subGoals.map((subGoal) => <option key={subGoal.id} value={subGoal.id}>{subGoal.title}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Project<select required value={projectId} onChange={(event) => setProjectId(event.target.value)} className={fieldClass}><option value="" disabled>Select a project</option>{availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name} ({project.departmentName})</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Task<select required value={taskId} onChange={(event) => setTaskId(event.target.value)} className={fieldClass}><option value="" disabled>Select an independent task</option>{activeTasks.map((task) => <option key={task.id} value={task.id}>{task.title}{task.category !== 'General' ? ` (${task.category})` : ''}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Member<select required value={memberId} onChange={(event) => setMemberId(event.target.value)} className={fieldClass}><option value="" disabled>Select a member</option>{availableMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Overall Status<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className={fieldClass}>{ASSIGNMENT_STATUS_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label>
            <label className="text-sm font-medium text-slate-700">Start Date<input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={fieldClass} /></label>
            <label className="text-sm font-medium text-slate-700">End Date<input required type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} className={fieldClass} /></label>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          {(!availableProjects.length || !activeTasks.length || !availableMembers.length) && (
            <p className="mt-4 text-sm text-amber-700">At least one active project, Task Master record, and member are required.</p>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={pending || !subGoalId || !projectId || !taskId || !memberId} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{pending ? 'Saving...' : 'Save Assignment'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
