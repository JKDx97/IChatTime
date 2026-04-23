'use client';

import { useState, FormEvent, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, MessageCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';

const fieldVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } }),
};

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Token inválido o expirado');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100">
          <Lock className="h-7 w-7 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Enlace inválido</h2>
        <p className="mt-2 text-sm text-gray-500">
          Este enlace de recuperación no es válido. Solicita uno nuevo.
        </p>
        <Link
          href="/forgot-password"
          className="btn-primary mt-6 inline-flex gap-2"
        >
          Solicitar nuevo enlace
        </Link>
      </div>
    );
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
          {done ? '¡Contraseña actualizada!' : 'Nueva contraseña'}
        </motion.h2>
        <motion.p
          className="mt-1.5 text-sm text-gray-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          {done
            ? 'Ya puedes iniciar sesión con tu nueva contraseña'
            : 'Ingresa tu nueva contraseña'}
        </motion.p>
      </div>

      {done ? (
        <motion.div
          className="space-y-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
            <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-500" />
            <p className="text-sm font-medium text-green-800">
              Tu contraseña ha sido restablecida exitosamente.
            </p>
          </div>

          <Link
            href="/login"
            className="btn-primary group relative w-full gap-2 overflow-hidden flex items-center justify-center"
          >
            Iniciar sesión
          </Link>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* New Password */}
          <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Nueva contraseña
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
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

          {/* Confirm Password */}
          <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Confirmar contraseña
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                className="input-field pl-10"
              />
            </div>
          </motion.div>

          {error && (
            <motion.p
              className="text-sm text-red-500 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {error}
            </motion.p>
          )}

          {/* Submit */}
          <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
            <button
              type="submit"
              disabled={busy}
              className="btn-primary group relative w-full gap-2 overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 transition-opacity group-hover:opacity-100" />
              <Lock className="h-4 w-4" />
              {busy ? 'Guardando…' : 'Restablecer contraseña'}
            </button>
          </motion.div>

          <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible">
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver a iniciar sesión
            </Link>
          </motion.div>
        </form>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-primary-600" /></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
