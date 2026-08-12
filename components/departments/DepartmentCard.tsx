import Link from 'next/link';
import {
  ArrowRight,
  Target,
  Users,
} from 'lucide-react';

import ProgressBar from '@/components/common/ProgressBar';
import type { DepartmentCardProps } from '@/types';

export default function DepartmentCard({
  department,
}: DepartmentCardProps) {
  const temporary = department.id.startsWith('temp-');

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">

      <div className="flex items-start justify-between">

        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            {department.name}
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            {department.description}
          </p>
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            department.isActive
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {department.isActive ? 'Active' : 'Inactive'}
        </span>

      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">

        <div className="rounded-lg bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-slate-500">
            <Users size={16} />
            <span className="text-xs">
              Members
            </span>
          </div>

          <p className="mt-1 text-lg font-semibold text-slate-900">
            {department.memberIds.length}
          </p>
        </div>

        <div className="rounded-lg bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-slate-500">
            <Target size={16} />
            <span className="text-xs">
              Goals
            </span>
          </div>

          <p className="mt-1 text-lg font-semibold text-slate-900">
            {department.goals.length}
          </p>
        </div>

      </div>

      <div className="mt-5">
        <div className="mb-2 flex justify-between">
          <span className="text-sm text-slate-500">
            Department progress
          </span>

          <span className="text-sm font-semibold text-slate-700">
            {department.progress}%
          </span>
        </div>

        <ProgressBar
          value={department.progress}
          size="sm"
        />
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">

        {temporary ? (
          <span className="text-sm text-amber-600">
            Temporary UI department
          </span>
        ) : (
          <Link
            href={`/departments/${department.id}`}
            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            View Department
            <ArrowRight size={15} />
          </Link>
        )}

      </div>

    </div>
  );
}