'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';

interface DropdownItem {
  label: string;
  count?: number;
  onClick?: () => void | Promise<void>;
  children?: React.ReactNode;
}

interface DropdownProps {
  content: DropdownItem[];
}

export default function Dropdown({
  content,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const dropdownRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(
      event: MouseEvent,
    ) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(
          event.target as Node,
        )
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener(
      'mousedown',
      handleClickOutside,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside,
      );
    };
  }, []);

  function toggleDropdown() {
    const nextOpen = !isOpen;

    setIsOpen(nextOpen);

    if (
      nextOpen &&
      content[0]?.onClick
    ) {
      void content[0].onClick();
    }
  }

  const notificationItem =
    content[0];

  return (
    <div
      ref={dropdownRef}
      className="relative"
    >
      <button
        type="button"
        aria-label={
          notificationItem?.label ??
          'Open dropdown'
        }
        aria-expanded={isOpen}
        onClick={toggleDropdown}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
      >
        {notificationItem?.label ===
        'Notifications' ? (
          <Bell size={18} />
        ) : null}

        {(notificationItem?.count ??
          0) > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {(notificationItem
              ?.count ?? 0) > 99
              ? '99+'
              : notificationItem
                  ?.count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          {content.map(
            (item, index) => (
              <div
                key={`${item.label}-${index}`}
              >
                <div className="flex min-w-64 items-center justify-between border-b border-slate-100 px-4 py-3">
                  <span className="text-sm font-semibold text-slate-900">
                    {item.label}
                  </span>

                  {(item.count ??
                    0) > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                      {(item.count ??
                        0) > 99
                        ? '99+'
                        : item.count}
                    </span>
                  )}
                </div>

                {item.children}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}