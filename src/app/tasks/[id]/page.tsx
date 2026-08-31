import type { QueryResultRow } from 'pg';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Layout } from '@/components';
import AssignmentHierarchy from '@/components/assignments/AssignmentHierarchy';
import { db } from '@/lib/db';
import { toKeyAssignment } from '@/lib/key-assignment-data';
import { getUnifiedWorkReport } from '@/lib/unified-work-report';

export const dynamic = 'force-dynamic';

interface TaskMasterRow extends QueryResultRow {
  id: string;
  title: string;
  category: string;
  is_active: boolean;
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [taskResult, report] = await Promise.all([
    db.query<TaskMasterRow>(
      `SELECT id, title, category, is_active
         FROM task_master
        WHERE id = $1
        LIMIT 1`,
      [id],
    ),
    getUnifiedWorkReport({ taskId: id }),
  ]);
  const task = taskResult.rows[0];
  if (!task) notFound();
  const assignments = report.map(toKeyAssignment);

  return (
    <Layout>
      <Link
        href="/tasks"
        className="mb-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
      >
        ← Task Master
      </Link>

      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Task</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{task.title}</h1>
          {!task.is_active && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              Archived
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-slate-500">{task.category}</p>
      </div>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Work Assignments ({assignments.length})
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Key → Sub Goal → Project → Task → Member → Data
          </p>
        </div>
        <AssignmentHierarchy assignments={assignments} />
      </section>
    </Layout>
  );
}
