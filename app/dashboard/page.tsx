import { Layout, Dashboard, DepartmentCard, ProgressBar } from '@/components';

export default function DashboardPage() {
  // Fetch departments from mock data
  const departments = window.__NEXT_DATA__.props.params.departments || (window.__NEXT_DATA__.pageData.departments || window.__NEXT_DATA__.pageData.mockData.departments);

  // Calculate summary statistics
  const totalDepartments = departments.length;
  const totalGoals = departments.reduce((sum, dept) => sum + dept.goals.length, 0);
  const totalActions = departments.reduce((sum, dept) => sum + dept.goals.reduce((sum2, goal) => sum2 + goal.actions.length, 0), 0);
  const totalMembers = departments.reduce((sum, dept) => sum + dept.memberIds.length, 0);

  // Calculate overall progress
  const departmentProgresses = departments.map(dept => dept.progress);
  const overallProgress = Math.round(departmentProgresses.reduce((a, b) => a + b, 0) / departmentProgresses.length);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-xl font-semibold text-zinc-800">
              Total Departments
            </h3>
            <div className="mb-2">
              <ProgressBar value={totalDepartments} max={totalDepartments} size="sm" label />
            </div>
            <p className="text-sm text-zinc-600">{totalDepartments}</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-zinc-800">
              Total Goals
            </h3>
            <div className="mb-2">
              <ProgressBar value={totalGoals} max={totalGoals} size="sm" label />
            </div>
            <p className="text-sm text-zinc-600">{totalGoals}</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-zinc-800">
              Total Actions
            </h3>
            <div className="mb-2">
              <ProgressBar value={totalActions} max={totalActions} size="sm" label />
            </div>
            <p className="text-sm text-zinc-600">{totalActions}</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-zinc-800">
              Total Members
            </h3>
            <div className="mb-2">
              <ProgressBar value={totalMembers} max={totalMembers} size="sm" label />
            </div>
            <p className="text-sm text-zinc-600">{totalMembers}</p>
          </div>
        </div>

        {/* Department Progress Overview */}
        <div className="mt-8 grid grid-cols-2 gap-6">
          {departments.map(dept => (
            <div key={dept.id} className="border border-zinc-200 rounded-lg shadow-sm p-4">
              <h3 className="text-xl font-semibold text-zinc-800 mb-2">{dept.name}</h3>
              <div className="flex flex-col items-start justify-between mb-2">
                <p className="text-sm text-zinc-500">{{department.id}} members</p>
                <p className="text-sm text-zinc-500">{{dept.goals.length}} goals</p>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-sm text-zinc-800">{{percentageCalculation(dept.progress)}}</span>
                <ProgressBar value={dept.progress} size="sm" />
              </div>
              <p className="text-sm text-zinc-600">{dept.description || 'Department overview'}</p>
              <a href={`/departments/${dept.id}`} className="text-blue-500 hover:text-blue-700 font-medium">View Department</a>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

function percentageCalculation(progress: number): string {
  return `${Math.round(progress)}%`;
}