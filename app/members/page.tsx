import { Layout } from '@/components';
import { getStructureData } from '@/lib/structure-data';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const { departments, members } = await getStructureData();
  const departmentNames = new Map(
    departments.map((department) => [department.id, department.name])
  );

  return (
    <Layout>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Members
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Organisation members and department assignments.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">

        <table className="w-full">

          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Name
              </th>

              <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Email
              </th>

              <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Role
              </th>

              <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">
                Department
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">

            {members.map((member) => {
              const assignedDepartments = (
                member.departmentIds ?? [member.departmentId]
              )
                .map((departmentId) => departmentNames.get(departmentId))
                .filter((name): name is string => Boolean(name));

              return (
                <tr key={member.id}>

                  <td className="px-5 py-4 font-medium text-slate-900">
                    {member.name}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-500">
                    {member.email}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {member.role}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {assignedDepartments.length
                      ? assignedDepartments.join(', ')
                      : 'Unassigned'}
                  </td>

                </tr>
              );
            })}

          </tbody>

        </table>

      </div>

    </Layout>
  );
}
