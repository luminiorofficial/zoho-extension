'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell } from 'lucide-react';

interface DropdownItem {
  label: string;
  count?: number;
  onClick?: () => void;
  children?: React.ReactNode;
}

interface DropdownProps {
  content: DropdownItem[];
}

export default function Dropdown({ content }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleItemClick = (item: DropdownItem) => {
    setIsOpen(false);
    item.onClick?.();
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        {content[0]?.label === 'Notifications' ? <Bell size={18} /> : null}
        {content[0]?.count && content[0]?.count > 0 && (
          <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
            {content[0].count > 99 ? '99+' : content[0].count}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 rounded-lg border border-slate-200 bg-white shadow-lg focus:outline-none z-50">
          {content.map((item, index) => (
            <div key={index}>
              {item.onClick ? (
                <div
                  onClick={() => handleItemClick(item)}
                  className="cursor-pointer px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-900">{item.label}</span>
                    {item.count !== undefined && item.count > 0 && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
                        {item.count > 99 ? '99+' : item.count}
                      </span>
                    )}
                  </div>
                  {item.children && (
                    <div className="mt-2">
                      {item.children}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/"
                  className="block px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                  onClick={() => setIsOpen(false)}
                >
                  <span className="text-sm font-medium text-slate-900">{item.label}</span>
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
        </div>
  );
}