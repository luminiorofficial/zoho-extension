import { Layout } from '@/components';
import TaskMasterClient from '@/components/assignments/TaskMasterClient';
import { getTaskMasterItems } from '@/lib/key-assignment-data';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const tasks = await getTaskMasterItems();
  return (
    <Layout>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900">Task Master</h1>
        <p className="mt-1 text-sm text-slate-500">Maintain the independent task list used by key assignments.</p>
      </div>
      <TaskMasterClient tasks={tasks} />
    </Layout>
  );
}
