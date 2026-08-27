import { Layout } from '@/components';
import KeysClient from '@/components/assignments/KeysClient';
import {
  getActiveMembersForAssignment,
  getActiveProjectsForAssignment,
  getAssignmentKeys,
  getKeyAssignments,
  getTaskMasterItems,
} from '@/lib/key-assignment-data';

export const dynamic = 'force-dynamic';

export default async function KeysPage() {
  const [keys, assignments, projects, tasks, members] = await Promise.all([
    getAssignmentKeys(),
    getKeyAssignments({}),
    getActiveProjectsForAssignment(),
    getTaskMasterItems(),
    getActiveMembersForAssignment(),
  ]);

  return (
    <Layout>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900">Work Planning</h1>
        <p className="mt-1 text-sm text-slate-500">Manage sub goals and plan work in one flow: Key to Sub Goal to Project to Task to Member.</p>
      </div>
      <KeysClient keys={keys} assignments={assignments} projects={projects} tasks={tasks} members={members} />
    </Layout>
  );
}
