import type { QueryResultRow } from 'pg';
import { notFound } from 'next/navigation';

import { Layout } from '@/components';
import { DepartmentManagementDashboard } from '@/components/departments/DepartmentExecution';
import { todayInIndia, trackerPeriod } from '@/lib/assignment-tracker-periods';
import { db } from '@/lib/db';
import { toKeyAssignment } from '@/lib/key-assignment-data';
import { getUnifiedWorkReport } from '@/lib/unified-work-report';

export const dynamic = 'force-dynamic';

interface DepartmentRow extends QueryResultRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface MemberRow extends QueryResultRow {
  id: string;
  name: string;
  team: string | null;
  role_title: string | null;
  is_active: boolean;
}

export default async function DepartmentPage({ params }: PageProps<'/departments/[id]'>) {
  const { id } = await params;
  const today = todayInIndia();
  const recent = trackerPeriod('RECENT_7', today);
  const [departmentResult, memberResult, report] = await Promise.all([
    db.query<DepartmentRow>(
      `SELECT id, name, description, is_active FROM departments WHERE id = $1 LIMIT 1`,
      [id],
    ),
    db.query<MemberRow>(
      `SELECT id, name, team, role_title, is_active
         FROM members
        WHERE current_department_id = $1
        ORDER BY is_active DESC, name`,
      [id],
    ),
    getUnifiedWorkReport({
      departmentId: id,
      includeDailyStatuses: true,
      dailyStatusStartDate: recent.start,
      dailyStatusEndDate: recent.end,
    }),
  ]);
  const department = departmentResult.rows[0];
  if (!department) notFound();

  return (
    <Layout>
      <DepartmentManagementDashboard
        department={{ id: department.id, name: department.name, description: department.description, isActive: department.is_active }}
        members={memberResult.rows.map((member) => ({
          id: member.id,
          name: member.name,
          team: member.team,
          roleTitle: member.role_title,
          isActive: member.is_active,
        }))}
        assignments={report.map(toKeyAssignment)}
        initialToday={today}
      />
    </Layout>
  );
}
