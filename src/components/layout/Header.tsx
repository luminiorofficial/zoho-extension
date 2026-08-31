'use client';

import { usePathname } from 'next/navigation';

import HeaderSearch from '@/components/layout/HeaderSearch';

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

  if (pathname.startsWith('/attendance')) {
    return 'Attendance';
  }

  if (pathname.startsWith('/reports')) {
    return 'Reports & Evaluations';
  }

  if (pathname.startsWith('/search')) {
    return 'Search';
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
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-6 border-b border-slate-200 bg-white px-6 lg:px-8">
      <div className="shrink-0">
        <h2 className="text-xl font-semibold text-slate-900">
          {title}
        </h2>

        <p className="text-sm text-slate-500">
          Department Goal
          Management
        </p>
      </div>

      <div className="hidden min-w-0 flex-1 justify-center lg:flex">
        <HeaderSearch />
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
          U
        </div>
      </div>
    </header>
  );
}
