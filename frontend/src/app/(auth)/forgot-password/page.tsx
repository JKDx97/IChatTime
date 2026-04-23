'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, MessageCircle, Send } from 'lucide-react';
import api from '@/lib/api';

const fieldVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } }),
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al enviar el correo');
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
          {sent ? 'Correo enviado' : '¿Olvidaste tu contraseña?'}
        </motion.h2>
        <motion.p
          className="mt-1.5 text-sm text-gray-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          {sent
            ? 'Revisa tu bandeja de entrada y sigue las instrucciones'
            : 'Ingresa tu correo y te enviaremos un enlace para restablecerla'}
        </motion.p>
      </div>

      {sent ? (
        <motion.div
          className="space-y-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
            <Mail className="mx-auto mb-2 h-8 w-8 text-green-500" />
            <p className="text-sm font-medium text-green-800">
              Hemos enviado un enlace de recuperación a
            </p>
            <p className="mt-1 text-sm font-bold text-green-900">{email}</p>
            <p className="mt-2 text-xs text-green-600">
              El enlace expira en 1 hora. Si no lo ves, revisa tu carpeta de spam.
            </p>
          </div>

          <Link
            href="/login"
            className="btn-primary group relative w-full gap-2 overflow-hidden flex items-center justify-center"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a iniciar sesión
          </Link>
        </motion.div>
      ) : (
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
          <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
            <button
              type="submit"
              disabled={busy}
              className="btn-primary group relative w-full gap-2 overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 transition-opacity group-hover:opacity-100" />
              <Send className="h-4 w-4" />
              {busy ? 'Enviando…' : 'Enviar enlace de recuperación'}
            </button>
          </motion.div>

          <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
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
