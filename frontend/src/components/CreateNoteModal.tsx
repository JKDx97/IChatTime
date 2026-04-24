'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import Avatar from './Avatar';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export default function CreateNoteModal({ open, onClose, onCreated }: Props) {
  const user = useAuthStore((s) => s.user);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 200);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) handleClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, busy]);

  function handleClose() {
    if (!busy) {
      setContent('');
      onClose();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) {
      toast.error('Escribe algo para publicar');
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('content', content);
      await api.post('/posts', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('¡Nota publicada!');
      setContent('');
      onClose();
      onCreated?.();
    } catch {
      toast.error('No se pudo publicar la nota');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      <div className="relative z-10 w-full max-w-lg md:mx-4 animate-slide-up md:animate-modal-enter">
        <div className="rounded-t-2xl md:rounded-2xl bg-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <button
              onClick={handleClose}
              disabled={busy}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 transition"
            >
              Cancelar
            </button>
            <h2 className="text-base font-bold text-gray-900">Nueva Nota</h2>
            <button
              onClick={(e) => handleSubmit(e as any)}
              disabled={busy || !content.trim()}
              className="text-sm font-bold text-teal-600 transition hover:text-teal-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? 'Publicando…' : 'Publicar'}
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit}>
            <div className="flex gap-3 px-5 pt-4 pb-2">
              <Avatar src={user?.avatarUrl} alt={user?.displayName} size={36} />
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="¿Qué tienes en mente?"
                rows={5}
                maxLength={2200}
                className="flex-1 resize-none border-none bg-transparent text-[15px] text-gray-900 placeholder-gray-400 outline-none"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
              <p className="text-xs text-gray-400">Solo texto · sin multimedia</p>
              <span className="text-xs text-gray-400">
                {content.length}/2200
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
