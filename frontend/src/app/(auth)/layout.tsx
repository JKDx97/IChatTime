'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import LoadingLogo from '@/components/LoadingLogo';
import { useAuthStore } from '@/lib/store';
import PhoneMockup from '@/components/auth/PhoneMockup';
import TypewriterSlogan from '@/components/auth/TypewriterSlogan';
import FloatingParticles from '@/components/auth/FloatingParticles';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!loading && user) router.replace('/feed');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <LoadingLogo size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel – animated branding */}
      <div className="relative hidden lg:flex lg:w-[55%] flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-primary-800 via-primary-600 to-indigo-600 p-12">
        {/* Floating background particles */}
        {mounted && <FloatingParticles />}

        {/* Mesh gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.15),transparent_50%)]" />

        {/* Phone mockup + slogan */}
        <div className="relative z-10 flex flex-col items-center gap-10">
          {mounted && <PhoneMockup />}
          {mounted && <TypewriterSlogan />}
        </div>

        {/* Decorative gradient orbs */}
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-48 w-48 rounded-full bg-purple-500/5 blur-3xl" />
      </div>

      {/* Right panel – form */}
      <div className="relative flex w-full items-center justify-center bg-gradient-to-b from-white via-gray-50/80 to-gray-100 px-6 lg:w-[45%]">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '24px 24px' }} />

        <motion.div
          className="relative w-full max-w-[420px]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Glass card */}
          <div className="rounded-2xl border border-gray-200/60 bg-white/80 px-8 py-10 shadow-xl shadow-gray-200/40 backdrop-blur-sm">
            {children}
          </div>

          {/* Brand footer on mobile */}
          <p className="mt-6 text-center text-xs text-gray-400 lg:hidden">
            IChatTime &mdash; Comparte momentos con el mundo
          </p>
        </motion.div>
      </div>
    </div>
  );
}
