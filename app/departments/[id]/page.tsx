import { Layout } from '@/components';
import Header from '@/components/layout/Header';

export default function DepartmentDetailsPage({ params }) {
  // Simulate data fetching from mock data
  const departmentId = params.id;
  window.__NEXT_DATA__.pageData.departments
    .find(dept => dept.id === departmentId);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-zinc-800 mb-6">{departmentId}</h1>

        {/* Add detailed content */}
        <p className="text-sm text-zinc-500 mb-4">
          This is where the detailed department information would be displayed.
        </p>

        {/* Add goal actions and member assignments */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-xl font-semibold text-zinc-800 mb-4">Member Goals</h3>
            <p className="text-sm text-zinc-500">{departmentId}.goals.length} total goals</p>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-zinc-800 mb-4">Current Members</h3>
            <p className="text-sm text-zinc-500">{departmentId}.memberIds.length} members</p>
          </div>
        </div>

        {/* Add action list section */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-zinc-800 mb-4">Recent Actions</h3>
          <div className="grid grid-cols-1 gap-4">
            {departmentId}.actions.map(action => (
              <div key={action.id} className="bg-zinc-50 rounded-lg p-4 hover:bg-zinc-100 transition-all duration-200">
                <h4 className="text-lg font-medium text-zinc-800 mb-2">{action.title}</h4>
                <p className="text-sm text-zinc-600">{action.description || 'Action description'}</p>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-3">{action.status}</span>
                  <ProgressBar value={action.progress} max={100} size="sm" label />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}