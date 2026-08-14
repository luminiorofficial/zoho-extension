'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { BarChart3, CheckSquare, ClipboardCheck, Save, Target } from 'lucide-react';

import ProgressBar from '@/components/common/ProgressBar';
import { periodDisplayLabel } from '@/lib/reporting-periods';
import type { KpiReportRow, ReportingData } from '@/types';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function MetricCard({
  title,
  progress,
  detail,
  icon: Icon,
}: {
  title: string;
  progress: number;
  detail: string;
  icon: typeof CheckSquare;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-3xl font-bold text-slate-900">{Math.round(progress)}%</p></div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Icon size={19} /></div>
      </div>
      <ProgressBar value={progress} size="sm" className="mt-4" />
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function KpiEntry({ kpi, data }: { kpi: KpiReportRow; data: ReportingData }) {
  const router = useRouter();
  const [achieved, setAchieved] = useState(kpi.achievedValue?.toString() ?? '');
  const [note, setNote] = useState(kpi.note ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/target-measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: kpi.targetId,
          memberId: data.filters.memberId ?? null,
          periodType: data.filters.periodType,
          periodDate: data.filters.periodDate,
          achievedValue: achieved,
          note,
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not save KPI achievement.');
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save KPI achievement.');
    } finally {
      setPending(false);
    }
  }

  const unit = kpi.targetUnit ? ` ${kpi.targetUnit}` : '';
  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-4 py-4"><p className="font-medium text-slate-800">{kpi.title}</p><p className="mt-1 text-xs text-slate-500">{kpi.departmentName} · {kpi.goalTitle}</p></td>
      <td className="px-4 py-4 text-sm font-semibold text-slate-700">{kpi.targetValue}{unit}</td>
      <td className="px-4 py-4"><input aria-label={`Achieved value for ${kpi.title}`} type="number" min="0" step="any" value={achieved} onChange={(event) => setAchieved(event.target.value)} className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" /></td>
      <td className="min-w-40 px-4 py-4"><p className="text-sm font-semibold text-slate-800">{kpi.progress === undefined ? '—' : `${Math.round(kpi.progress)}%`}</p><ProgressBar value={kpi.progress ?? 0} size="sm" className="mt-2" /></td>
      <td className="px-4 py-4"><input aria-label={`Note for ${kpi.title}`} value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" className="w-full min-w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />{error && <p className="mt-1 text-xs text-red-600">{error}</p>}</td>
      <td className="px-4 py-4"><button type="button" disabled={pending || achieved === ''} onClick={() => void save()} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"><Save size={14} />{pending ? 'Saving' : 'Save'}</button></td>
    </tr>
  );
}

export default function ReportsClient({ data }: { data: ReportingData }) {
  const router = useRouter();
  const [evaluation, setEvaluation] = useState(() => {
    const current = data.reviews.find((review) => !review.isImported
      && review.departmentId === data.filters.departmentId
      && (review.memberId ?? '') === (data.filters.memberId ?? '')
      && (review.goalId ?? '') === (data.filters.goalId ?? ''));
    return {
      score: current?.score?.toString() ?? '',
      summary: current?.summary ?? '',
      achievements: current?.achievements ?? '',
      challenges: current?.challenges ?? '',
      nextSteps: current?.nextSteps ?? '',
    };
  });
  const [evaluationPending, setEvaluationPending] = useState(false);
  const [evaluationMessage, setEvaluationMessage] = useState('');
  const members = useMemo(() => data.members.filter((member) => (
    !data.filters.departmentId || member.departmentId === data.filters.departmentId
  )), [data]);
  const goals = data.goals.filter((goal) => !data.filters.departmentId || goal.departmentId === data.filters.departmentId);
  const periodLabel = periodDisplayLabel({
    type: data.filters.periodType,
    start: data.periodStart,
    end: data.periodEnd,
  });

  async function saveEvaluation() {
    if (!data.filters.departmentId) {
      setEvaluationMessage('Select a department before saving an evaluation.');
      return;
    }
    setEvaluationPending(true);
    setEvaluationMessage('');
    try {
      const response = await fetch('/api/period-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: data.filters.departmentId,
          memberId: data.filters.memberId ?? null,
          goalId: data.filters.goalId ?? null,
          periodType: data.filters.periodType,
          periodDate: data.filters.periodDate,
          ...evaluation,
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not save evaluation.');
      setEvaluationMessage('Evaluation saved.');
      router.refresh();
    } catch (saveError) {
      setEvaluationMessage(saveError instanceof Error ? saveError.message : 'Could not save evaluation.');
    } finally {
      setEvaluationPending(false);
    }
  }

  return (
    <>
      <form method="GET" className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-sm font-medium text-slate-700">Department<select name="departmentId" defaultValue={data.filters.departmentId ?? ''} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">All departments</option>{data.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Member<select name="memberId" defaultValue={data.filters.memberId ?? ''} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">All members / department KPI</option>{members.map((item) => <option key={`${item.id}-${item.departmentId}`} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Goal<select name="goalId" defaultValue={data.filters.goalId ?? ''} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">All goals</option>{goals.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Report period<select name="periodType" defaultValue={data.filters.periodType} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Financial quarter</option><option value="YEARLY">Financial year (Apr–Mar)</option></select></label>
          <label className="text-sm font-medium text-slate-700">Date in period<input name="periodDate" type="date" defaultValue={data.filters.periodDate} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm" /></label>
        </div>
        <div className="mt-4 flex items-center justify-between gap-4"><p className="text-sm text-slate-500">{periodLabel} · {formatDate(data.periodStart)} – {formatDate(data.periodEnd)}</p><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Apply filters</button></div>
      </form>

      <div className="grid gap-5 md:grid-cols-2">
        <MetricCard title="Task Progress" progress={data.taskProgress.progress} detail={`${data.taskProgress.doneTasks}/${data.taskProgress.totalTasks} tasks done`} icon={CheckSquare} />
        <MetricCard title="KPI Progress" progress={data.kpiProgress} detail={`${data.kpis.filter((kpi) => kpi.achievedValue !== undefined).length}/${data.kpis.length} KPIs measured`} icon={Target} />
      </div>

      <section className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4"><BarChart3 className="text-blue-600" size={20} /><div><h2 className="font-semibold text-slate-900">KPI Progress</h2><p className="text-sm text-slate-500">Record achieved values; progress is calculated from the stored target.</p></div></div>
        {data.kpis.length ? <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">KPI</th><th className="px-4 py-3">Target</th><th className="px-4 py-3">Achieved</th><th className="px-4 py-3">Progress</th><th className="px-4 py-3">Note</th><th className="px-4 py-3"><span className="sr-only">Save</span></th></tr></thead><tbody>{data.kpis.map((kpi) => <KpiEntry key={kpi.targetId} kpi={kpi} data={data} />)}</tbody></table></div> : <p className="p-5 text-sm text-slate-500">No numeric KPIs match this scope and period.</p>}
      </section>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3"><ClipboardCheck className="text-blue-600" size={20} /><div><h2 className="font-semibold text-slate-900">Management Evaluation</h2><p className="text-sm text-slate-500">Evaluation uses the exact department, member, goal, and period selected above.</p></div></div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Score (0–100)<input type="number" min="0" max="100" step="0.01" value={evaluation.score} onChange={(event) => setEvaluation({ ...evaluation, score: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">Summary<textarea rows={3} maxLength={5000} value={evaluation.summary} onChange={(event) => setEvaluation({ ...evaluation, summary: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700">Achievements<textarea rows={4} maxLength={5000} value={evaluation.achievements} onChange={(event) => setEvaluation({ ...evaluation, achievements: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700">Challenges<textarea rows={4} maxLength={5000} value={evaluation.challenges} onChange={(event) => setEvaluation({ ...evaluation, challenges: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
          <label className="text-sm font-medium text-slate-700 md:col-span-2">Next steps<textarea rows={4} maxLength={5000} value={evaluation.nextSteps} onChange={(event) => setEvaluation({ ...evaluation, nextSteps: event.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
        </div>
        <div className="mt-4 flex items-center justify-between gap-4"><p className={`text-sm ${evaluationMessage === 'Evaluation saved.' ? 'text-emerald-600' : 'text-red-600'}`}>{evaluationMessage}</p><button type="button" disabled={evaluationPending || !data.filters.departmentId} onClick={() => void saveEvaluation()} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"><Save size={15} />{evaluationPending ? 'Saving' : 'Save evaluation'}</button></div>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold text-slate-900">Evaluation History</h2>
        <p className="mt-1 text-sm text-slate-500">Imported reviews remain read-only and visible alongside management entries.</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">{data.reviews.map((review) => <article key={review.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-slate-900">{review.memberName ?? review.departmentName ?? 'Organisation review'}</p><p className="mt-1 text-xs text-slate-500">{review.goalTitle ?? 'All goals'} · {formatDate(review.periodStart)} – {formatDate(review.periodEnd)}</p></div><div className="flex items-center gap-2">{review.isImported && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">Imported</span>}{review.score !== undefined && <span className="rounded-full bg-blue-50 px-2 py-1 text-sm font-semibold text-blue-700">{review.score}/100</span>}</div></div>{review.summary && <p className="mt-4 text-sm text-slate-700">{review.summary}</p>}<dl className="mt-4 space-y-3 text-sm">{review.achievements && <div><dt className="font-medium text-slate-800">Achievements</dt><dd className="mt-1 whitespace-pre-wrap text-slate-600">{review.achievements}</dd></div>}{review.challenges && <div><dt className="font-medium text-slate-800">Challenges</dt><dd className="mt-1 whitespace-pre-wrap text-slate-600">{review.challenges}</dd></div>}{review.nextSteps && <div><dt className="font-medium text-slate-800">Next steps</dt><dd className="mt-1 whitespace-pre-wrap text-slate-600">{review.nextSteps}</dd></div>}</dl></article>)}{!data.reviews.length && <p className="text-sm text-slate-500">No evaluations recorded for this period.</p>}</div>
      </section>
    </>
  );
}
