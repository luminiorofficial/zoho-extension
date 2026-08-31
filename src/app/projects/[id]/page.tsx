import type { QueryResultRow } from 'pg';
import { notFound } from 'next/navigation';

import { Layout } from '@/components';
import ProjectDeleteAction from '@/components/projects/ProjectDeleteAction';
import { ProjectAssignmentDashboard } from '@/components/projects/ProjectDetailClient';
import { todayInIndia, trackerPeriod } from '@/lib/assignment-tracker-periods';
import { db } from '@/lib/db';
import { toKeyAssignment } from '@/lib/key-assignment-data';
import { CLOSURE_ITEM_LABELS } from '@/lib/project-constants';
import { getUnifiedWorkReport } from '@/lib/unified-work-report';
import type { ClosureItemKey, ProjectStatus } from '@/types';

export const dynamic = 'force-dynamic';

interface ProjectRow extends QueryResultRow {
  id: string;
  name: string;
  code: string | null;
  client_name: string | null;
  description: string | null;
  department_name: string;
  owner_name: string | null;
  start_date: string | Date | null;
  end_date: string | Date | null;
  status: string;
  budget: string | null;
  is_active: boolean;
}

interface ClosureRow extends QueryResultRow {
  id: string;
  item_key: ClosureItemKey;
  assigned_member_name: string | null;
  is_required: boolean;
  is_completed: boolean;
}

const projectStatuses: Record<string, ProjectStatus> = {
  PLANNED: 'Planned', ACTIVE: 'Active', INTERNAL_REVIEW: 'Internal Review',
  CLIENT_REVIEW: 'Client Review', DELIVERED: 'Delivered',
  CLOSURE_PENDING: 'Closure Pending', CLOSED: 'Closed',
};

function dateString(value: string | Date | null): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export default async function ProjectDetailPage({ params, searchParams }: PageProps<'/projects/[id]'>) {
  const { id } = await params;
  const query = await searchParams;
  const today = todayInIndia();
  const recent = trackerPeriod('RECENT_7', today);
  const [projectResult, closureResult, report] = await Promise.all([
    db.query<ProjectRow>(
      `SELECT p.id, p.name, p.code, p.client_name, p.description,
              d.name AS department_name, owner.name AS owner_name,
              p.start_date, p.end_date, p.status, p.budget, p.is_active
         FROM projects p
         JOIN departments d ON d.id = p.department_id
         LEFT JOIN members owner ON owner.id = p.owner_member_id
        WHERE p.id = $1
        LIMIT 1`,
      [id],
    ),
    db.query<ClosureRow>(
      `SELECT pci.id, pci.item_key, m.name AS assigned_member_name,
              pci.is_required, pci.is_completed
         FROM project_closure_items pci
         LEFT JOIN members m ON m.id = pci.assigned_member_id
        WHERE pci.project_id = $1
        ORDER BY pci.created_at, pci.item_key`,
      [id],
    ),
    getUnifiedWorkReport({
      projectId: id,
      includeDailyStatuses: true,
      dailyStatusStartDate: recent.start,
      dailyStatusEndDate: recent.end,
    }),
  ]);
  const project = projectResult.rows[0];
  if (!project) notFound();

  const content = (
    <ProjectAssignmentDashboard
      project={{
        id: project.id,
        name: project.name,
        code: project.code,
        clientName: project.client_name,
        description: project.description,
        departmentName: project.department_name,
        ownerName: project.owner_name,
        startDate: dateString(project.start_date),
        deadline: dateString(project.end_date),
        status: projectStatuses[project.status] ?? 'Planned',
        budget: project.budget === null ? null : Number(project.budget),
        isActive: project.is_active,
      }}
      assignments={report.map(toKeyAssignment)}
      closureItems={closureResult.rows.map((item) => ({
        id: item.id,
        label: CLOSURE_ITEM_LABELS[item.item_key],
        assignedMemberName: item.assigned_member_name,
        required: item.is_required,
        completed: item.is_completed,
      }))}
      initialToday={today}
      headerAction={<ProjectDeleteAction projectId={project.id} projectName={project.name} isActive={project.is_active} />}
    />
  );

  if (query.embed === 'zoho') return <main className="min-h-screen bg-slate-50 p-5"><div className="mx-auto max-w-7xl">{content}</div></main>;
  return <Layout>{content}</Layout>;
}
