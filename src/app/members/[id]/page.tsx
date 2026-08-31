import type { QueryResultRow } from 'pg';
import { notFound } from 'next/navigation';

import { Layout } from '@/components';
import AssignmentHierarchy from '@/components/assignments/AssignmentHierarchy';
import { db } from '@/lib/db';
import { toKeyAssignment } from '@/lib/key-assignment-data';
import { getUnifiedWorkReport } from '@/lib/unified-work-report';

export const dynamic = 'force-dynamic';

interface MemberRow extends QueryResultRow {
  id: string;
  name: string;
  email: string | null;
  role_title: string | null;
  team: string | null;
  department_name: string | null;
  is_active: boolean;
}

export default async function MemberPage({ params }: PageProps<'/members/[id]'>) {
  const { id } = await params;
  const [memberResult, report] = await Promise.all([
    db.query<MemberRow>(
      `SELECT m.id, m.name, m.email, m.role_title, m.team, m.is_active,
              d.name AS department_name
         FROM members m
         LEFT JOIN departments d ON d.id = m.current_department_id
        WHERE m.id = $1
        LIMIT 1`,
      [id],
    ),
    getUnifiedWorkReport({ memberId: id }),
  ]);
  const assignments = report.map(toKeyAssignment);
  const member = memberResult.rows[0];
  if (!member) notFound();

  return (
    <Layout>
      <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Member</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{member.name}</h1>
          {!member.is_active && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Inactive</span>}
        </div>
        <p className="mt-2 text-sm text-slate-500">{member.role_title ?? 'Role not set'}{member.department_name ? ` · ${member.department_name}` : ''}{member.team ? ` · ${member.team}` : ''}</p>
        {member.email && <p className="mt-1 text-sm text-slate-500">{member.email}</p>}
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
