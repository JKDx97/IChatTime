'use client';

import { useState, useRef, FormEvent, useEffect } from 'react';
import Image from 'next/image';
import { ImagePlus, X, Film } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import Avatar from './Avatar';

interface MediaItem {
  file: File;
  preview: string;
  isVideo: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const MAX_FILES = 10;

export default function CreatePostModal({ open, onClose, onCreated }: Props) {
  const user = useAuthStore((s) => s.user);
  const [caption, setCaption] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea on open
  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 200);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  function reset() {
    setCaption('');
    mediaItems.forEach((m) => URL.revokeObjectURL(m.preview));
    setMediaItems([]);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files;
    if (!selected) return;
    const remaining = MAX_FILES - mediaItems.length;
    if (remaining <= 0) { toast.error(`Máximo ${MAX_FILES} archivos`); return; }
    const newItems: MediaItem[] = [];
    for (let i = 0; i < Math.min(selected.length, remaining); i++) {
      const f = selected[i];
      if (f.size > 50 * 1024 * 1024) { toast.error(`"${f.name}" supera 50 MB`); continue; }
      newItems.push({
        file: f,
        preview: URL.createObjectURL(f),
        isVideo: f.type.startsWith('video/'),
      });
    }
    if (selected.length > remaining) {
      toast.error(`Solo se pueden añadir ${remaining} archivos más`);
    }
    setMediaItems((prev) => [...prev, ...newItems]);
    if (fileRef.current) fileRef.current.value = '';
  }

  function removeMedia(index: number) {
    setMediaItems((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (mediaItems.length === 0) { toast.error('Debes añadir al menos una imagen o video'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('content', caption);
      mediaItems.forEach((m) => fd.append('media', m.file));
      await api.post('/posts', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('¡Publicación creada!');
      reset();
      onClose();
      onCreated?.();
    } catch {
      toast.error('No se pudo crear la publicación');
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    if (!busy) {
      reset();
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg mx-4 animate-modal-enter">
        <div className="rounded-2xl bg-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <button
              onClick={handleClose}
              disabled={busy}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 transition"
            >
              Cancelar
            </button>
            <h2 className="text-base font-bold text-gray-900">Crear publicación</h2>
            <button
              onClick={(e) => handleSubmit(e as any)}
              disabled={busy || mediaItems.length === 0}
              className="text-sm font-bold text-primary-600 transition hover:text-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
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
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="¿Qué estás pensando?"
                rows={3}
                maxLength={2200}
                className="flex-1 resize-none border-none bg-transparent text-[15px] text-gray-900 placeholder-gray-400 outline-none"
              />
            </div>

            {/* Media previews */}
            {mediaItems.length > 0 && (
              <div className="mx-5 mb-3 flex gap-2 overflow-x-auto pb-2">
                {mediaItems.map((m, i) => (
                  <div key={i} className="relative shrink-0 w-36 h-36 overflow-hidden rounded-xl border border-gray-100">
                    {m.isVideo ? (
                      <div className="relative w-full h-full bg-black flex items-center justify-center">
                        <video src={m.preview} muted preload="metadata" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Film className="h-6 w-6 text-white/80" />
                        </div>
                      </div>
                    ) : (
                      <Image src={m.preview} alt={`Vista previa ${i + 1}`} width={144} height={144} className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(i)}
                      className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white transition hover:bg-black/90 active:scale-90"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Footer toolbar */}
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={mediaItems.length >= MAX_FILES}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary-600 transition hover:bg-primary-50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ImagePlus className="h-5 w-5" />
                <span className="font-medium">Foto / Video ({mediaItems.length}/{MAX_FILES})</span>
              </button>
              <span className="text-xs text-gray-400">
                {caption.length}/2200
              </span>
            </div>

            <input ref={fileRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" multiple onChange={handleFiles} className="hidden" />
          </form>
        </div>
      </div>
    </div>
  );
}
