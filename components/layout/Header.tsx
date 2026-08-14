'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Bell, Search } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import Dropdown from '@/components/layout/Dropdown';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  entityType: string;
  entityId: string | null;
}

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

  if (pathname.startsWith('/settings')) {
    return 'Settings';
  }

  return 'Dashboard';
}

export default function Header() {
  const pathname = usePathname();
  const [query, setDebouncedValue] = useDebouncedValue('', 300);
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch notifications
  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json() as { notifications?: NotificationItem[] };
        const nextNotifications = Array.isArray(data.notifications) ? data.notifications : [];
        setNotifications(nextNotifications);
        setUnreadCount(nextNotifications.length);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle search form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
  };

  // Get page title
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

      <div className="relative flex-1 hidden lg:flex items-center gap-4">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
              value={query}
              onChange={(e) => setDebouncedValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
            />
          </div>
        </form>
      </div>

      <div className="flex items-center gap-4">
        <Dropdown content={[
          {
            label: 'Notifications',
            count: unreadCount,
            onClick: fetchNotifications,
            children: loading ? (
              <div className="p-4">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                No notifications
              </div>
            ) : (
              <div className="w-64 max-h-64 overflow-y-auto">
                {notifications.map((n: NotificationItem) => (
                  <Link
                    key={n.id}
                    href={n.entityId ? `/${n.entityType}/${n.entityId}` : '/'}
                    className="block p-3 border-b border-gray-200 hover:bg-gray-50"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        {n.type === 'task_assignment' && (
                          <span className="w-3 h-3 bg-blue-600 rounded-full" />
                        )}
                        {n.type === 'overdue_task' && (
                          <span className="w-3 h-3 bg-red-600 rounded-full" />
                        )}
                        {n.type === 'project_deadline' && (
                          <span className="w-3 h-3 bg-orange-600 rounded-full" />
                        )}
                        {n.type === 'leave_approval' && (
                          <span className="w-3 h-3 bg-green-600 rounded-full" />
                        )}
                        <span className="w-3 h-3 bg-gray-400 rounded-full" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{n.title}</p>
                        <p className="text-xs text-gray-500">{n.message}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          }
        ]} />
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 relative"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}
        </button>

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
          U
        </div>
      </div>
    </header>
  );
}