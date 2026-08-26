'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';

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

function notificationHref(
  notification: NotificationItem,
): string {
  if (!notification.entityId) {
    return '/';
  }

  if (
    notification.entityType ===
    'project'
  ) {
    return `/projects/${notification.entityId}`;
  }

  if (
    notification.entityType ===
    'member'
  ) {
    return `/members/${notification.entityId}`;
  }

  if (
    notification.entityType ===
    'department'
  ) {
    return `/departments/${notification.entityId}`;
  }

  return '/';
}

function notificationDotClass(
  type: string,
): string {
  if (type === 'task_assignment') {
    return 'bg-blue-600';
  }

  if (type === 'overdue_task') {
    return 'bg-red-600';
  }

  if (
    type === 'project_deadline'
  ) {
    return 'bg-orange-500';
  }

  if (
    type === 'leave_approval'
  ) {
    return 'bg-emerald-500';
  }

  return 'bg-slate-400';
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const [query, setQuery] =
    useDebouncedValue('', 300);

  const [
    notifications,
    setNotifications,
  ] = useState<NotificationItem[]>(
    [],
  );

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const [loading, setLoading] =
    useState(false);

  async function fetchNotifications() {
    setLoading(true);

    try {
      const response = await fetch(
        '/api/notifications',
        {
          cache: 'no-store',
        },
      );

      if (!response.ok) {
        return;
      }

      const data =
        (await response.json()) as {
          notifications?: NotificationItem[];
        };

      const nextNotifications =
        Array.isArray(
          data.notifications,
        )
          ? data.notifications
          : [];

      setNotifications(
        nextNotifications,
      );

      setUnreadCount(
        nextNotifications.length,
      );
    } catch (error) {
      console.error(
        'Failed to fetch notifications:',
        error,
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const trimmedQuery =
      query.trim();

    if (!trimmedQuery) {
      return;
    }

    router.push(
      `/search?q=${encodeURIComponent(
        trimmedQuery,
      )}`,
    );
  }

  const title =
    getPageTitle(pathname);

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
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-xl"
        >
          <div className="relative">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="search"
              placeholder="Search departments, members, goals, projects, tasks..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target.value,
                )
              }
            />
          </div>
        </form>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <Dropdown
          content={[
            {
              label:
                'Notifications',

              count:
                unreadCount,

              onClick:
                fetchNotifications,

              children: loading ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  Loading...
                </div>
              ) : notifications.length ===
                0 ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  No notifications
                </div>
              ) : (
                <div className="max-h-80 w-80 overflow-y-auto">
                  {notifications.map(
                    (
                      notification,
                    ) => (
                      <Link
                        key={
                          notification.id
                        }
                        href={notificationHref(
                          notification,
                        )}
                        className="block border-b border-slate-100 p-3 transition hover:bg-slate-50 last:border-b-0"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${notificationDotClass(
                              notification.type,
                            )}`}
                          />

                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900">
                              {
                                notification.title
                              }
                            </p>

                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {
                                notification.message
                              }
                            </p>
                          </div>
                        </div>
                      </Link>
                    ),
                  )}
                </div>
              ),
            },
          ]}
        />

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
          U
        </div>
      </div>
    </header>
  );
}