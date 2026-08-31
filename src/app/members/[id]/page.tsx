import type { QueryResultRow } from 'pg';
import { notFound } from 'next/navigation';

import { Layout } from '@/components';
import { MemberAssignmentDashboard } from '@/components/members/MemberWorkClient';
import { todayInIndia, trackerPeriod } from '@/lib/assignment-tracker-periods';
import { db } from '@/lib/db';
import {
  getActiveMembersForAssignment,
  getActiveProjectsForAssignment,
  getAssignmentKeys,
  getTaskMasterItems,
  toKeyAssignment,
} from '@/lib/key-assignment-data';
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
  const today = todayInIndia();
  const recent = trackerPeriod('RECENT_7', today);
  const [memberResult, report, keys, projects, tasks, members] = await Promise.all([
    db.query<MemberRow>(
      `SELECT m.id, m.name, m.email, m.role_title, m.team, m.is_active,
              d.name AS department_name
         FROM members m
         LEFT JOIN departments d ON d.id = m.current_department_id
        WHERE m.id = $1
        LIMIT 1`,
      [id],
    ),
    getUnifiedWorkReport({
      memberId: id,
      includeDailyStatuses: true,
      dailyStatusStartDate: recent.start,
      dailyStatusEndDate: recent.end,
    }),
    getAssignmentKeys(),
    getActiveProjectsForAssignment(),
    getTaskMasterItems(),
    getActiveMembersForAssignment(),
  ]);
  const member = memberResult.rows[0];
  if (!member) notFound();

  return (
    <Layout>
      <MemberAssignmentDashboard
        member={{
          id: member.id,
          name: member.name,
          email: member.email,
          roleTitle: member.role_title,
          team: member.team,
          departmentName: member.department_name,
          isActive: member.is_active,
        }}
        assignments={report.map(toKeyAssignment)}
        keys={keys}
        projects={projects}
        tasks={tasks}
        members={members}
        initialToday={today}
      />
    </Layout>
  );
}
