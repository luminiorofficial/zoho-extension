'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RotateCcw, Trash2, X } from 'lucide-react';

interface ProjectDeleteActionProps {
  projectId: string;
  projectName: string;
  isActive: boolean;
}

export default function ProjectDeleteAction({ projectId, projectName, isActive }: ProjectDeleteActionProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function confirmDelete() {
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      const body = await response.json() as { error?: string; message?: string; project?: { deleted?: boolean } };
      if (!response.ok) throw new Error(body.error ?? 'Could not delete the project.');
      setShowConfirm(false);
      if (body.project?.deleted) {
        router.push('/projects');
      } else {
        setMessage(body.message ?? 'Project archived.');
      }
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the project.');
    } finally {
      setPending(false);
    }
  }

  async function restore() {
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not restore the project.');
      setMessage('Project restored.');
      router.refresh();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Could not restore the project.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {isActive ? (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <Trash2 size={16} /> Delete Project
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => void restore()}
          className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
        >
          <RotateCcw size={16} /> {pending ? 'Restoring…' : 'Restore Project'}
        </button>
      )}
      {error && <p className="max-w-xs text-right text-xs text-red-600">{error}</p>}
      {message && <p className="max-w-xs text-right text-xs text-slate-500">{message}</p>}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="flex items-center gap-2 font-semibold text-slate-900">
                <AlertTriangle size={18} className="text-red-500" /> Delete Project
              </h2>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3 p-6 text-sm text-slate-600">
              <p>
                Delete <span className="font-semibold text-slate-900">{projectName}</span>?
              </p>
              <p>
                If this project has any historical or active work data (assignments, weekly goals, daily
                tasks, closure items, or a Zoho link), it will be <span className="font-medium">archived</span>{' '}
                instead of permanently removed &mdash; historical records stay intact. Only a project with no
                data at all is permanently deleted.
              </p>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={pending}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={pending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? 'Deleting…' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
