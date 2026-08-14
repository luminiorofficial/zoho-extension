import {
  AlertTriangle,
  Building2,
  CheckSquare,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';

import { Layout } from '@/components';
import { getStructureData } from '@/lib/structure-data';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { departments, members } = await getStructureData();

  const totalGoals = departments.reduce(
    (total, department) => total + department.goals.length,
    0
  );

  const totalActions = departments.reduce(
    (total, department) =>
      total +
      department.goals.reduce(
        (goalTotal, goal) => goalTotal + goal.actions.length,
        0
      ),
    0
  );

  const totalMembers = members.length;

  const overallProgress =
    departments.length > 0
      ? Math.round(
          departments.reduce(
            (total, department) => total + department.progress,
            0
          ) / departments.length
        )
      : 0;

  // Sort departments by progress
  const sortedDepartments = [...departments].sort(
    (a, b) => b.progress - a.progress
  );

  const topDepartment = sortedDepartments[0] ?? null;

  const needsAttention =
    sortedDepartments.length > 0
      ? sortedDepartments[sortedDepartments.length - 1]
      : null;

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
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Dashboard
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Organisation-wide performance overview.
        </p>
      </div>

      {/* Top Stats */}
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

      {/* Management Summary */}
      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {/* Overall Progress */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Overall Progress
              </p>

              <p className="mt-2 text-3xl font-bold text-slate-900">
                {overallProgress}%
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Target size={21} />
            </div>
          </div>

          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{
                width: `${Math.min(overallProgress, 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Top Performer */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Top Performer
              </p>

              <p className="mt-2 text-xl font-semibold text-slate-900">
                {topDepartment?.name ?? 'No data'}
              </p>

              {topDepartment && (
                <p className="mt-2 text-3xl font-bold text-emerald-600">
                  {topDepartment.progress}%
                </p>
              )}
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp size={21} />
            </div>
          </div>
        </div>

        {/* Needs Attention */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">
                Needs Attention
              </p>

              <p className="mt-2 text-xl font-semibold text-slate-900">
                {needsAttention?.name ?? 'No data'}
              </p>

              {needsAttention && (
                <p className="mt-2 text-3xl font-bold text-amber-600">
                  {needsAttention.progress}%
                </p>
              )}
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <AlertTriangle size={21} />
            </div>
          </div>
        </div>
      </div>

      {/* Department Performance Graph */}
      {/* Department Performance Graph */}
<div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

  {/* Header */}
  <div className="border-b border-slate-100 px-6 py-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Department Performance
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Compare overall progress across departments.
        </p>
      </div>

      {/* Performance Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">

        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Excellent
        </div>

        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          Good
        </div>

        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          Average
        </div>

        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          Attention
        </div>

      </div>
    </div>
  </div>

  {/* Graph */}
  <div className="p-6">

    {departments.length === 0 ? (

      <div className="py-12 text-center text-sm text-slate-500">
        No department data available.
      </div>

    ) : (

      <div className="space-y-7">

        {sortedDepartments.map((department, index) => {

          const progress = Math.min(
            Math.max(department.progress, 0),
            100
          );

          let barColor = '';
          let badgeColor = '';
          let status = '';

          if (progress >= 80) {
            barColor =
              'bg-gradient-to-r from-emerald-400 to-emerald-600';

            badgeColor =
              'bg-emerald-50 text-emerald-700 border-emerald-200';

            status = 'Excellent';
          } else if (progress >= 60) {
            barColor =
              'bg-gradient-to-r from-blue-400 to-blue-600';

            badgeColor =
              'bg-blue-50 text-blue-700 border-blue-200';

            status = 'Good';
          } else if (progress >= 40) {
            barColor =
              'bg-gradient-to-r from-amber-400 to-orange-500';

            badgeColor =
              'bg-amber-50 text-amber-700 border-amber-200';

            status = 'Average';
          } else {
            barColor =
              'bg-gradient-to-r from-red-400 to-red-600';

            badgeColor =
              'bg-red-50 text-red-700 border-red-200';

            status = 'Needs Attention';
          }

          return (
            <div
              key={department.id}
              className="group"
            >

              {/* Department Details */}
              <div className="mb-2.5 flex items-center justify-between gap-4">

                <div className="flex min-w-0 items-center gap-3">

                  {/* Ranking */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                    #{index + 1}
                  </div>

                  <div className="min-w-0">

                    <p className="truncate text-sm font-semibold text-slate-800">
                      {department.name}
                    </p>

                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">

                      <span>
                        {department.goals.length} goals
                      </span>

                      <span>•</span>

                      <span>
                        {status}
                      </span>

                    </div>

                  </div>

                </div>

                {/* Percentage Badge */}
                <div
                  className={`shrink-0 rounded-lg border px-3 py-1 text-sm font-bold ${badgeColor}`}
                >
                  {progress}%
                </div>

              </div>

              {/* Progress Bar */}
              <div className="relative h-4 overflow-hidden rounded-full bg-slate-100">

                {/* subtle graph lines */}
                <div className="absolute inset-0 flex">
                  <div className="w-1/4 border-r border-white/70" />
                  <div className="w-1/4 border-r border-white/70" />
                  <div className="w-1/4 border-r border-white/70" />
                  <div className="w-1/4" />
                </div>

                <div
                  className={`relative h-full rounded-full ${barColor} shadow-sm transition-all duration-700 ease-out`}
                  style={{
                    width: `${progress}%`,
                  }}
                />

              </div>

            </div>
          );
        })}

        {/* Graph scale */}
        <div className="flex justify-between border-t border-slate-100 pt-4 text-xs text-slate-400">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>

      </div>
    )}

  </div>
</div>
    </Layout>
  );
}