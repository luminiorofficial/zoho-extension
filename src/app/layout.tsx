import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { Suspense } from 'react';

import NavigationLoader from '@/components/common/NavigationLoader';

import './globals.css';

const geist = Geist({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Department Goal Manager',
  description:
    'Department, goal and task management extension for Zoho Projects',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={geist.className}>
        <Suspense fallback={null}>
          <NavigationLoader />
        </Suspense>

        {children}
      </body>
    </html>
  );
}