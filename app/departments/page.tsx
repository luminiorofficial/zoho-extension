import { Layout, Sidebar, Header, DepartmentCard } from '@/components';

export default function DepartmentsPage() {
  // Get departments from mock data
  const departments = window.__NEXT_DATA__.props.params.departments || (window.__NEXT_DATA__.pageData.departments || window.__NEXT_DATA__.pageData.mockData.departments);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-zinc-800 mb-6">Departments</h1>

        {/* Add Department Button */}
        <div className="flex justify-end mb-6">
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onclick="addNewDepartment()"
          >
            Add Department
          </button>
        </div>

        {/* Department List */}
        <div className="grid grid-cols-2 gap-6">
          {departments.map(dept => (
            <DepartmentCard
              key={dept.id}
              department={dept}
              onActionClick={() => console.log(`View goal for ${dept.name}`)}
            />
          ))}
        </div>
      </div>
    </Layout>
  );

  function addNewDepartment() {
    // Mock implementation - in real app this would open a form
    const newDept = {
      id: `dept-${Date.now()}`,
      name: 'New Department' + Math.floor(Math.random() * 100),
      description: 'New department created at ${new Date().toLocaleDateString()}',
      headId: 'm9',
      memberIds: [],
      progress: 0,
      isActive: true
    };

    departments.push(newDept);
  }
}