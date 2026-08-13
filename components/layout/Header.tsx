'use client';

import { usePathname } from 'next/navigation';
import { Bell, Search } from 'lucide-react';

function getPageTitle(pathname: string) {
  if (pathname.startsWith('/departments')) {
    return 'Departments';
  }

  if (pathname.startsWith('/members')) {
    return 'Members';
  }

  if (pathname.startsWith('/projects')) {
    return 'Projects';
  }

  if (pathname.startsWith('/workload')) {
    return 'Workload';
  }

  if (pathname.startsWith('/settings')) {
    return 'Settings';
  }

  return 'Dashboard';
}

export default function Header() {
  const pathname = usePathname();

  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white px-8">

      <div>
        <h2 className="text-xl font-semibold text-slate-900">
          {title}
        </h2>

        <p className="text-sm text-slate-500">
          Department Goal Management
        </p>
      </div>

      <div className="flex items-center gap-4">

        <div className="relative hidden lg:block">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            placeholder="Search..."
            className="w-64 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
          />
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
        >
          <Bell size={18} />
        </button>

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
          U
        </div>

      </div>
    </header>
  );
}
