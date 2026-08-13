import {
  Building2,
  CheckSquare,
  Target,
  Users,
} from 'lucide-react';

import {
  DepartmentCard,
  Layout,
} from '@/components';
import { getStructureData } from '@/lib/structure-data';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { departments, members } = await getStructureData();

  const totalGoals = departments.reduce(
    (total, department) =>
      total + department.goals.length,
    0
  );

  const totalActions = departments.reduce(
    (total, department) =>
      total +
      department.goals.reduce(
        (goalTotal, goal) =>
          goalTotal + goal.actions.length,
        0
      ),
    0
  );

  const totalMembers = members.length;

  const overallProgress =
    departments.length > 0
      ? Math.round(
          departments.reduce(
            (total, department) =>
              total + department.progress,
            0
          ) / departments.length
        )
      : 0;

  const stats = [
    {
      name: 'Departments',
      value: departments.length,
      icon: Building2,
    },
    {
      name: 'Goals',
      value: totalGoals,
      icon: Target,
    },
    {
      name: 'Actions',
      value: totalActions,
      icon: CheckSquare,
    },
    {
      name: 'Members',
      value: totalMembers,
      icon: Users,
    },
  ];

  return (
    <Layout>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Dashboard
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Organisation-wide department and goal overview.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">

        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.name}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >

              <div className="flex items-center justify-between">

                <div>
                  <p className="text-sm text-slate-500">
                    {stat.name}
                  </p>

                  <p className="mt-2 text-3xl font-bold text-slate-900">
                    {stat.value}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Icon size={21} />
                </div>

              </div>

            </div>
          );
        })}

      </div>

      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">

        <p className="text-sm text-slate-500">
          Overall Progress
        </p>

        <p className="mt-1 text-3xl font-bold text-slate-900">
          {overallProgress}%
        </p>

      </div>

      <div className="mt-8">

        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            Department Overview
          </h2>

          <p className="text-sm text-slate-500">
            Track department-wise goals and task progress.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

          {departments.map((department) => (
            <DepartmentCard
              key={department.id}
              department={department}
            />
          ))}

        </div>

      </div>

    </Layout>
  );
}
