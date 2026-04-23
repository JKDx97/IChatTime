'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { UserPlus, User, AtSign, Mail, Lock, Eye, EyeOff, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store';

const fieldVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } }),
};

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', displayName: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const register = useAuthStore((s) => s.register);
  const router = useRouter();

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await register(form);
      router.push('/feed');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg[0] : msg || 'Error al registrarse');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8 text-center">
        <motion.div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-primary-600 shadow-lg shadow-emerald-200/50"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <Sparkles className="h-7 w-7 text-white" />
        </motion.div>
        <motion.h2
          className="text-2xl font-bold tracking-tight text-gray-900"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          Crear cuenta
        </motion.h2>
        <motion.p
          className="mt-1.5 text-sm text-gray-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
        >
          Únete a IChatTime y comparte momentos
        </motion.p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Username & Display Name */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Usuario
            </label>
            <div className="relative">
              <AtSign className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                required
                value={form.username}
                onChange={(e) => update('username', e.target.value)}
                placeholder="juanperez"
                className="input-field pl-10"
              />
            </div>
          </motion.div>
          <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Nombre
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                required
                value={form.displayName}
                onChange={(e) => update('displayName', e.target.value)}
                placeholder="Juan Pérez"
                className="input-field pl-10"
              />
            </div>
          </motion.div>
        </div>

        {/* Email */}
        <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
            Correo electrónico
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="tu@ejemplo.com"
              className="input-field pl-10"
            />
          </div>
        </motion.div>

        {/* Password */}
        <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
            Contraseña
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              placeholder="Mín. 6 caracteres"
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
          <p className="mt-1 text-[11px] text-gray-400">Mínimo 6 caracteres</p>
        </motion.div>

        {/* Submit */}
        <motion.div custom={4} variants={fieldVariants} initial="hidden" animate="visible">
          <button
            type="submit"
            disabled={busy}
            className="btn-primary group relative mt-1 w-full gap-2 overflow-hidden"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 transition-opacity group-hover:opacity-100" />
            <UserPlus className="h-4 w-4" />
            {busy ? 'Creando cuenta…' : 'Crear cuenta'}
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
        ¿Ya tienes una cuenta?{' '}
        <Link href="/login" className="font-semibold text-primary-600 transition-colors hover:text-primary-700">
          Inicia sesión
        </Link>
      </motion.p>
    </>
  );
}
