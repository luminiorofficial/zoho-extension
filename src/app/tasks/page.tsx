import { Layout } from '@/components';
import TaskMasterClient from '@/components/assignments/TaskMasterClient';
import { getTaskMasterItems } from '@/lib/key-assignment-data';
import { getUnifiedWorkReport } from '@/lib/unified-work-report';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const [tasks, assignments] = await Promise.all([
    getTaskMasterItems(),
    getUnifiedWorkReport(),
  ]);
  const assignmentCounts = Object.fromEntries(
    assignments.reduce((counts, assignment) => {
      counts.set(
        assignment.task.id,
        (counts.get(assignment.task.id) ?? 0) + 1,
      );
      return counts;
    }, new Map<string, number>()),
  );
  return (
    <Layout>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900">Task Master</h1>
        <p className="mt-1 text-sm text-slate-500">Maintain the independent task list used by key assignments.</p>
      </div>
      <TaskMasterClient tasks={tasks} assignmentCounts={assignmentCounts} />
    </Layout>
  );
}
