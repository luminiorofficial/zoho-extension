'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users,
  Settings,
  Target,
  FolderKanban,
  Gauge,
  CalendarCheck2,
  ChartNoAxesCombined,
} from 'lucide-react';

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Departments',
    href: '/departments',
    icon: Building2,
  },
  {
    name: 'Members',
    href: '/members',
    icon: Users,
  },
  {
    name: 'Projects',
    href: '/projects',
    icon: FolderKanban,
  },
  {
    name: 'Workload',
    href: '/workload',
    icon: Gauge,
  },
  {
    name: 'Attendance',
    href: '/attendance',
    icon: CalendarCheck2,
  },
  {
    name: 'Reports & Evaluations',
    href: '/reports',
    icon: ChartNoAxesCombined,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-white">
      <div className="flex h-full flex-col">

        <div className="flex h-20 items-center border-b border-slate-200 px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Target size={20} />
            </div>

            <div>
              <h1 className="font-bold text-slate-900">
                Goal Manager
              </h1>

              <p className="text-xs text-slate-500">
                Zoho Extension
              </p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4">
          <div className="space-y-1">
            {navigation.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/dashboard' &&
                  pathname.startsWith(`${item.href}/`));

              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon size={19} />

                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>

      </div>
    </aside>
  );
}
