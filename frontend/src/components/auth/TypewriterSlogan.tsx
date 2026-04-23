'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const slogans = [
  'Comparte momentos con el mundo',
  'Conecta con personas increíbles',
  'Tu historia empieza aquí',
  'Cada momento cuenta',
  'Inspira y sé inspirado',
];

export default function TypewriterSlogan() {
  const [sloganIndex, setSloganIndex] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const currentSlogan = slogans[sloganIndex];

  const tick = useCallback(() => {
    if (!isDeleting) {
      // Typing
      if (displayed.length < currentSlogan.length) {
        setDisplayed(currentSlogan.slice(0, displayed.length + 1));
      } else {
        // Pause at full text, then start deleting
        setTimeout(() => setIsDeleting(true), 2000);
        return;
      }
    } else {
      // Deleting
      if (displayed.length > 0) {
        setDisplayed(currentSlogan.slice(0, displayed.length - 1));
      } else {
        setIsDeleting(false);
        setSloganIndex((prev) => (prev + 1) % slogans.length);
        return;
      }
    }
  }, [displayed, isDeleting, currentSlogan]);

  useEffect(() => {
    const speed = isDeleting ? 35 : 65;
    const timer = setTimeout(tick, speed);
    return () => clearTimeout(timer);
  }, [tick, isDeleting]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Logo */}
      <AnimatePresence mode="wait">
        <motion.div
          key="logo"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
            <svg viewBox="0 0 24 24" className="h-9 w-9 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Brand name */}
      <motion.h1
        className="text-4xl font-bold tracking-tight text-white"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        IChatTime
      </motion.h1>

      {/* Typewriter */}
      <motion.div
        className="h-8 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <span className="text-lg text-primary-100">
          {displayed}
        </span>
        <motion.span
          className="ml-0.5 inline-block h-5 w-0.5 bg-white"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
        />
      </motion.div>

      {/* Subtle stats */}
      <motion.div
        className="mt-4 flex gap-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.6 }}
      >
        {[
          { label: 'Posts', value: '12M+' },
          { label: 'Usuarios', value: '2.5M+' },
          { label: 'Países', value: '180+' },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-lg font-bold text-white">{stat.value}</p>
            <p className="text-[11px] text-primary-200">{stat.label}</p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
