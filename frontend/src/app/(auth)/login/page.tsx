'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { LogIn, Mail, Lock, Eye, EyeOff, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store';

const fieldVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } }),
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const login = useAuthStore((s) => s.login);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      router.push('/feed');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al iniciar sesión');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8 text-center">
        <motion.div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 shadow-lg shadow-primary-200/50"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <MessageCircle className="h-7 w-7 text-white" />
        </motion.div>
        <motion.h2
          className="text-2xl font-bold tracking-tight text-gray-900"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          Bienvenido de nuevo
        </motion.h2>
        <motion.p
          className="mt-1.5 text-sm text-gray-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          Inicia sesión en tu cuenta de IChatTime
        </motion.p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email */}
        <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
            Correo electrónico
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@ejemplo.com"
              className="input-field pl-10"
            />
          </div>
        </motion.div>

        {/* Password */}
        <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
            Contraseña
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-field pl-10 pr-10"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </motion.div>

        {/* Forgot password */}
        <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible" className="text-right">
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-primary-600 transition-colors hover:text-primary-700"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </motion.div>

        {/* Submit */}
        <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible">
          <button
            type="submit"
            disabled={busy}
            className="btn-primary group relative w-full gap-2 overflow-hidden"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 transition-opacity group-hover:opacity-100" />
            <LogIn className="h-4 w-4" />
            {busy ? 'Iniciando sesión…' : 'Iniciar sesión'}
          </button>
        </motion.div>
      </form>

      {/* Divider */}
      <motion.div
        className="my-6 flex items-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-400">o</span>
        <div className="h-px flex-1 bg-gray-200" />
      </motion.div>

      <motion.p
        className="text-center text-sm text-gray-500"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
      >
        ¿No tienes una cuenta?{' '}
        <Link href="/register" className="font-semibold text-primary-600 transition-colors hover:text-primary-700">
          Regístrate
        </Link>
      </motion.p>
    </>
  );
}
