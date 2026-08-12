import { notFound } from 'next/navigation';

import {
  GoalCard,
  Layout,
  ProgressBar,
} from '@/components';

import { mockData } from '@/data/mockData';

interface DepartmentPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function DepartmentPage({
  params,
}: DepartmentPageProps) {
  const { id } = await params;

  const department =
    mockData.departments.find(
      (item) => item.id === id
    );

  if (!department) {
    notFound();
  }

  const departmentMembers =
    mockData.members.filter((member) =>
      department.memberIds.includes(member.id)
    );

  return (
    <Layout>

      <div className="mb-8">

        <h1 className="text-2xl font-bold text-slate-900">
          {department.name}
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          {department.description}
        </p>

      </div>

      <div className="grid gap-5 md:grid-cols-3">

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Members
          </p>

          <p className="mt-2 text-2xl font-bold">
            {department.memberIds.length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Goals
          </p>

          <p className="mt-2 text-2xl font-bold">
            {department.goals.length}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Progress
          </p>

          <p className="mt-2 text-2xl font-bold">
            {department.progress}%
          </p>

          <div className="mt-3">
            <ProgressBar
              value={department.progress}
              size="sm"
            />
          </div>
        </div>

      </div>

      <div className="mt-8">

        <h2 className="mb-5 text-lg font-semibold text-slate-900">
          Department Goals
        </h2>

        <div className="space-y-5">

          {department.goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              members={departmentMembers}
            />
          ))}

        </div>

      </div>

    </Layout>
  );
}