'use client';

import { LoaderCircle } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function NavigationLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentUrl = `${pathname}?${searchParams.toString()}`;
  const [loadingUrl, setLoadingUrl] = useState<string | null>(null);
  const loading = loadingUrl !== null && loadingUrl !== currentUrl;

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest('a');

      if (!link) {
        return;
      }

      const href = link.getAttribute('href');

      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        link.target === '_blank' ||
        link.hasAttribute('download')
      ) {
        return;
      }

      const url = new URL(
        link.href,
        window.location.href,
      );

      if (url.origin !== window.location.origin) {
        return;
      }

      const browserUrl =
        window.location.pathname +
        window.location.search;

      const nextUrl =
        url.pathname +
        url.search;

      if (browserUrl === nextUrl) {
        return;
      }

      setLoadingUrl(`${url.pathname}?${url.searchParams.toString()}`);
    };

    document.addEventListener(
      'click',
      handleClick,
      true,
    );

    return () => {
      document.removeEventListener(
        'click',
        handleClick,
        true,
      );
    };
  }, []);

  if (!loading) {
    return null;
  }

  return (
    <>
      <div className="fixed left-0 top-0 z-[9999] h-1 w-full overflow-hidden bg-blue-100">
        <div className="h-full w-1/3 animate-pulse bg-blue-600" />
      </div>

      <div className="pointer-events-none fixed inset-0 z-[9998] flex items-center justify-center bg-white/20 backdrop-blur-[1px]">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
          <LoaderCircle className="h-5 w-5 animate-spin text-blue-600" />

          <span className="text-sm font-medium text-slate-700">
            Loading...
          </span>
        </div>
      </div>
    </>
  );
}
