'use client';

import { useSession } from 'next-auth/client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings } from 'lucide-react';

interface HeaderProps {
  className?: string;
}

export default function Header({ className }: HeaderProps) {
  const session = useSession();
  const pathname = usePathname();
  const isHome = pathname === '/dashboard' || pathname === '/'; // Check if this is the home/dashboard page

  return (
    <header className={{ className, ...(
      isHome
        ? {
            borderBottom: '1px solid var(--blue-200)',
          }
        : {}
    )}} bg-white shadow-md backdrop-filter blur-sm backdrop-blur-sm-md transition-all duration-200 min-h-[48px]">
      <div className="container mx-auto px-6 py-2 flex items-center justify-between">
        {isHome ? (
          <h1 className="font-extrabold text-lg text-black mb-4 relative">
            <Link href="/dashboard">
              <span className="text-neutral-600 font-semibold text-xs md:text-sm" data-testid="registry-title">Goal</span>Manager</Link>
            </h1>
          )
        : null}

        <nav className="flex items-center space-x-4">
          <Link href="/departments" className="text-gray-600 hover:text-blue-500 rounded-md py-1 px-4">
            {isHome ? 'Departments' : ''}
          </Link>
          <Link href="/members" className="text-gray-600 hover:text-blue-500 rounded-md py-1 px-4">
            {isHome ? 'Members' : ''}
          </Link>
          <Link href="/settings" className="text-gray-600 hover:text-blue-500 rounded-md py-1 px-4">
            Settings
          </Link>
        </nav>

        <div className="flex items-center">
          {session ? (
            <div className="flex items-center gap-2 rounded-md py-1 px-3 text-gray-400 hover:bg-gray-50 hover:text-gray-800 rounded-lg">
              <img
                className="h-6 w-6 rounded-full hover:shadow-sm shadow-base"
                src={session.user?.image}
                alt="User Profile"
                decoded
              />
              <span className="font-medium text-sm truncate">
                {session.user?.name}</span>
            </div>
          ) : (}
          </div>
        </div>
      </div>
    </header>
  );
}