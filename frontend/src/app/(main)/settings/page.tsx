'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Lock, Eye, EyeOff, Check, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';

/* ─── Password strength calculator ─── */
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: 'bg-gray-200' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score: 1, label: 'Muy débil', color: 'bg-red-500' };
  if (score === 2) return { score: 2, label: 'Débil', color: 'bg-orange-500' };
  if (score === 3) return { score: 3, label: 'Media', color: 'bg-yellow-500' };
  if (score === 4) return { score: 4, label: 'Fuerte', color: 'bg-green-500' };
  return { score: 5, label: 'Muy fuerte', color: 'bg-emerald-600' };
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  /* ─── Profile state ─── */
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);

  /* ─── Password state ─── */
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const strength = useMemo(() => getPasswordStrength(newPassword), [newPassword]);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName);
      setUsername(user.username);
      setBio(user.bio ?? '');
    }
  }, [user]);

  /* ─── Profile dirty check ─── */
  const profileDirty =
    user &&
    (displayName !== user.displayName ||
      username !== user.username ||
      (bio || '') !== (user.bio || ''));

  /* ─── Save profile ─── */
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profileDirty || profileBusy) return;

    setProfileBusy(true);
    try {
      const { data } = await api.patch('/users/me', {
        displayName: displayName.trim(),
        username: username.trim(),
        bio: bio.trim(),
      });
      setUser(data);
      toast.success('Perfil actualizado');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      toast.error(typeof msg === 'string' ? msg : 'Error al actualizar perfil');
    }
    setProfileBusy(false);
  }

  /* ─── Change password ─── */
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setPasswordBusy(true);
    try {
      await api.post('/users/me/password', {
        currentPassword,
        newPassword,
      });
      toast.success('Contraseña actualizada');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      toast.error(typeof msg === 'string' ? msg : 'Error al cambiar la contraseña');
    }
    setPasswordBusy(false);
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="rounded-full p-2 hover:bg-gray-100 transition"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold">Editar perfil</h1>
      </div>

      {/* ═══════ Profile Section ═══════ */}
      <form onSubmit={handleSaveProfile} className="card p-5 space-y-5">
        <div className="flex items-center gap-2 text-primary-600">
          <User className="h-5 w-5" />
          <h2 className="font-semibold">Información personal</h2>
        </div>

        {/* Display Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre real
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition"
            placeholder="Tu nombre"
          />
          <p className="mt-1 text-xs text-gray-400">{displayName.length}/60</p>
        </div>

        {/* Username */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre de usuario
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">@</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9._]/g, ''))}
              maxLength={30}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-8 pr-4 py-2.5 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition"
              placeholder="usuario"
            />
          </div>
          <p className="mt-1 text-xs text-gray-400">{username.length}/30 · Solo letras, números, puntos y guiones bajos</p>
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Biografía
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={300}
            rows={3}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition resize-none"
            placeholder="Cuéntanos sobre ti..."
          />
          <p className="mt-1 text-xs text-gray-400">{bio.length}/300</p>
        </div>

        <button
          type="submit"
          disabled={!profileDirty || profileBusy}
          className="w-full rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {profileBusy ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
          ) : (
            <><Check className="h-4 w-4" /> Guardar cambios</>
          )}
        </button>
      </form>

      {/* ═══════ Password Section ═══════ */}
      <form onSubmit={handleChangePassword} className="card p-5 space-y-5">
        <div className="flex items-center gap-2 text-primary-600">
          <Lock className="h-5 w-5" />
          <h2 className="font-semibold">Cambiar contraseña</h2>
        </div>

        {/* Current Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contraseña actual
          </label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 pr-10 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition"
              placeholder="Ingresa tu contraseña actual"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* New Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nueva contraseña
          </label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 pr-10 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition"
              placeholder="Mínimo 6 caracteres"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Strength bar */}
          {newPassword.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                      i <= strength.score ? strength.color : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <p className={`text-xs font-medium ${
                strength.score <= 1 ? 'text-red-500' :
                strength.score === 2 ? 'text-orange-500' :
                strength.score === 3 ? 'text-yellow-600' :
                'text-green-600'
              }`}>
                {strength.label}
              </p>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirmar contraseña
          </label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full rounded-xl border bg-gray-50 px-4 py-2.5 pr-10 text-sm outline-none transition ${
                passwordsMismatch
                  ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                  : passwordsMatch
                  ? 'border-green-300 focus:border-green-400 focus:ring-2 focus:ring-green-100'
                  : 'border-gray-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100'
              }`}
              placeholder="Repite la nueva contraseña"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {passwordsMismatch && (
            <p className="mt-1 flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" /> Las contraseñas no coinciden
            </p>
          )}
          {passwordsMatch && (
            <p className="mt-1 flex items-center gap-1 text-xs text-green-600">
              <Check className="h-3 w-3" /> Las contraseñas coinciden
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={
            !currentPassword ||
            !newPassword ||
            !confirmPassword ||
            newPassword !== confirmPassword ||
            newPassword.length < 6 ||
            passwordBusy
          }
          className="w-full rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {passwordBusy ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Cambiando...</>
          ) : (
            <><Lock className="h-4 w-4" /> Cambiar contraseña</>
          )}
        </button>
      </form>
    </div>
  );
}
