'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building2,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';

interface SidebarProps {
  className?: string;
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Departments', href: '/departments', icon: Building2 },
  { name: 'Members', href: '/members', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen bg-white border-r border-zinc-200 transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-64'
      } ${className || ''}`}
      aria-label="Main navigation"
    >
      <div className="flex h-full flex-col">
        {/* Logo / Brand */}
        <div
          className={`flex h-16 items-center justify-between px-4 border-b border-zinc-200 transition-all duration-200 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2 text-xl font-semibold text-zinc-900">
              <Building2 className="h-6 w-6 text-blue-600" aria-hidden="true" />
              <span>GoalManager</span>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            ) : (
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2" aria-label="Main navigation">
          <ul className="space-y-1" role="list">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    } ${collapsed ? 'justify-center' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    title={collapsed ? item.name : undefined}
                  >
                    <item.icon
                      className="h-5 w-5 flex-shrink-0"
                      aria-hidden="true"
                    />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer / User section placeholder */}
        <div
          className={`border-t border-zinc-200 p-4 transition-all duration-200 ${
            collapsed ? 'hidden' : 'block'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-sm font-medium text-blue-700">U</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 truncate">User Name</p>
              <p className="text-xs text-zinc-500 truncate">user@example.com</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}