import type { QueryResultRow } from 'pg';
import { notFound } from 'next/navigation';

import { Layout } from '@/components';
import AssignmentHierarchy from '@/components/assignments/AssignmentHierarchy';
import { db } from '@/lib/db';
import { getKeyAssignments } from '@/lib/key-assignment-data';

export const dynamic = 'force-dynamic';

interface ProjectRow extends QueryResultRow {
  id: string;
  name: string;
  code: string | null;
  client_name: string | null;
  description: string | null;
  department_name: string;
  is_active: boolean;
}

export default async function ProjectDetailPage({ params, searchParams }: PageProps<'/projects/[id]'>) {
  const { id } = await params;
  const query = await searchParams;
  const [projectResult, assignments] = await Promise.all([
    db.query<ProjectRow>(
      `SELECT p.id, p.name, p.code, p.client_name, p.description,
              d.name AS department_name, p.is_active
         FROM projects p
         JOIN departments d ON d.id = p.department_id
        WHERE p.id = $1
        LIMIT 1`,
      [id],
    ),
    getKeyAssignments({ projectId: id }),
  ]);
  const project = projectResult.rows[0];
  if (!project) notFound();

  const content = (
    <>
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Project</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
          {!project.is_active && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Inactive</span>}
        </div>
        <p className="mt-2 text-sm text-slate-500">{project.department_name}{project.client_name ? ` · ${project.client_name}` : ''}{project.code ? ` · ${project.code}` : ''}</p>
        {project.description && <p className="mt-3 text-sm text-slate-600">{project.description}</p>}
      </div>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Work Assignments ({assignments.length})</h2>
          <p className="mt-1 text-sm text-slate-500">Project → Key → Sub Goal → Task → Member → Dates</p>
        </div>
        <AssignmentHierarchy assignments={assignments} view="project" />
      </section>
    </>
  );

  if (query.embed === 'zoho') {
    return <main className="min-h-screen bg-slate-50 p-5"><div className="mx-auto max-w-7xl">{content}</div></main>;
  }

  return <Layout>{content}</Layout>;
}
