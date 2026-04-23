'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import Navbar from '@/components/Navbar';
import FriendsSidebar from '@/components/FriendsSidebar';
import LoadingLogo from '@/components/LoadingLogo';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <LoadingLogo size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <FriendsSidebar />
      {/* Content area: centered on viewport, constrained on smaller screens to avoid sidebar overlap */}
      <main className="mx-auto px-4 py-6 pb-20 md:pb-6 animate-page-enter max-w-3xl md:max-w-[calc(100vw-72px-220px-2rem)] xl:max-w-3xl">
        {children}
      </main>
    </div>
  );
}
