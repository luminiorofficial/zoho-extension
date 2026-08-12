'use client';

import { FormEvent, useState } from 'react';
import { Plus, X } from 'lucide-react';

import DepartmentCard from './DepartmentCard';

import type { Department } from '@/types';

interface DepartmentsClientProps {
  initialDepartments: Department[];
}

export default function DepartmentsClient({
  initialDepartments,
}: DepartmentsClientProps) {
  const [departments, setDepartments] =
    useState<Department[]>(initialDepartments);

  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    const department: Department = {
      id: `temp-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      memberIds: [],
      progress: 0,
      isActive: true,
      goals: [],
    };

    setDepartments((current) => [
      ...current,
      department,
    ]);

    setName('');
    setDescription('');
    setShowForm(false);
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">

        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Departments
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage departments, their goals and tasks.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={18} />
          Add Department
        </button>

      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

        {departments.map((department) => (
          <DepartmentCard
            key={department.id}
            department={department}
          />
        ))}

      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">

          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">

            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">

              <h2 className="font-semibold text-slate-900">
                Add Department
              </h2>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>

            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-4 p-6"
            >

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Department Name
                </label>

                <input
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  placeholder="Example: Human Resources"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="Department description"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">

                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Add Department
                </button>

              </div>

            </form>

          </div>

        </div>
      )}
    </>
  );
}