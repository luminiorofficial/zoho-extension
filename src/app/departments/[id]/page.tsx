import type { QueryResultRow } from 'pg';
import { notFound } from 'next/navigation';

import { Layout } from '@/components';
import AssignmentHierarchy from '@/components/assignments/AssignmentHierarchy';
import { db } from '@/lib/db';
import { getKeyAssignments } from '@/lib/key-assignment-data';

export const dynamic = 'force-dynamic';

interface DepartmentRow extends QueryResultRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export default async function DepartmentPage({ params }: PageProps<'/departments/[id]'>) {
  const { id } = await params;
  const [departmentResult, assignments] = await Promise.all([
    db.query<DepartmentRow>(
      `SELECT id, name, description, is_active
         FROM departments
        WHERE id = $1
        LIMIT 1`,
      [id],
    ),
    getKeyAssignments({ departmentId: id }),
  ]);
  const department = departmentResult.rows[0];
  if (!department) notFound();

  return (
    <Layout>
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Department</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{department.name}</h1>
          {!department.is_active && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Inactive</span>}
        </div>
        {department.description && <p className="mt-2 text-sm text-slate-500">{department.description}</p>}
      </div>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Work Assignments ({assignments.length})</h2>
          <p className="mt-1 text-sm text-slate-500">Key → Sub Goal → Project → Task → Member → Data</p>
        </div>
        <AssignmentHierarchy assignments={assignments} />
      </section>
    </Layout>
  );
}
