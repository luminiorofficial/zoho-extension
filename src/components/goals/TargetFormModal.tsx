'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { Target } from '@/types';

interface TargetFormModalProps {
  goalId: string;
  target: Target | null;
  onClose: () => void;
}

export default function TargetFormModal({ goalId, target, onClose }: TargetFormModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState(target?.title ?? '');
  const [targetText, setTargetText] = useState(target?.targetText ?? '');
  const [targetValue, setTargetValue] = useState(target?.targetValue?.toString() ?? '');
  const [targetUnit, setTargetUnit] = useState(target?.targetUnit ?? '');
  const [periodType, setPeriodType] = useState(target?.periodType ?? '');
  const [startDate, setStartDate] = useState(target?.startDate ?? '');
  const [endDate, setEndDate] = useState(target?.endDate ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const response = await fetch(target ? `/api/targets/${target.id}` : '/api/targets', {
        method: target ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId, title, targetText, targetValue, targetUnit, periodType, startDate, endDate }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not save the target.');
      onClose();
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save the target.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl"><div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4"><h2 className="font-semibold text-slate-900">{target ? 'Edit Target / KPI' : 'Add Target / KPI'}</h2><button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Close"><X size={20} /></button></div>
      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        <label className="block text-sm font-medium text-slate-700">Title<input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
        <label className="block text-sm font-medium text-slate-700">KPI details<textarea rows={3} value={targetText} onChange={(event) => setTargetText(event.target.value)} className="mt-1 w-full resize-none rounded-lg border border-slate-300 px-3 py-2" /></label>
        <div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium text-slate-700">Target value<input type="number" step="any" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium text-slate-700">Unit<input maxLength={100} value={targetUnit} onChange={(event) => setTargetUnit(event.target.value)} placeholder="leads, %, INR…" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium text-slate-700">Period<select value={periodType} onChange={(event) => setPeriodType(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">Not set</option><option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="YEARLY">Yearly</option><option value="CUSTOM">Custom</option></select></label></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Start date<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm font-medium text-slate-700">End date<input type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label></div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
        <div className="flex justify-end gap-3 pt-2"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600">Cancel</button><button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{pending ? 'Saving…' : 'Save Target'}</button></div>
      </form></div></div>
  );
}
