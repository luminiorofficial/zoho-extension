import { Layout } from '@/components';
import KeysClient from '@/components/assignments/KeysClient';
import { todayInIndia, trackerPeriod } from '@/lib/assignment-tracker-periods';
import {
  getActiveMembersForAssignment,
  getActiveProjectsForAssignment,
  getAssignmentKeys,
  getTaskMasterItems,
  toKeyAssignment,
} from '@/lib/key-assignment-data';
import { getUnifiedWorkReport } from '@/lib/unified-work-report';

export const dynamic = 'force-dynamic';

export default async function KeysPage() {
  const today = todayInIndia();
  const recentPeriod = trackerPeriod('RECENT_7', today);
  const [keys, report, projects, tasks, members] = await Promise.all([
    getAssignmentKeys(),
    getUnifiedWorkReport({
      includeDailyStatuses: true,
      dailyStatusStartDate: recentPeriod.start,
      dailyStatusEndDate: recentPeriod.end,
    }),
    getActiveProjectsForAssignment(),
    getTaskMasterItems(),
    getActiveMembersForAssignment(),
  ]);
  const assignments = report.map(toKeyAssignment);
  const initialDailyStatuses = report.flatMap((item) => item.dailyStatuses);

  return (
    <Layout>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900">Work Planning</h1>
        <p className="mt-1 text-sm text-slate-500">Track daily execution by member, review history, and manage assignments without changing the hierarchy.</p>
      </div>
      <KeysClient
        keys={keys}
        assignments={assignments}
        projects={projects}
        tasks={tasks}
        members={members}
        initialDailyStatuses={initialDailyStatuses}
        initialToday={today}
      />
    </Layout>
  );
}
