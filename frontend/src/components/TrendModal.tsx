'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { X, Loader2, Heart, MessageCircle, Play, FileText, Film, ImageIcon } from 'lucide-react';
import api from '@/lib/api';
import type { Post, Flash } from '@/lib/types';
import Avatar from './Avatar';
import { renderHashtags } from '@/lib/renderHashtags';
import { timeAgo } from '@/lib/timeago';

interface Props {
  open: boolean;
  onClose: () => void;
  tag: string;
  onOpenFlash?: (flashId: string) => void;
  onOpenPost?: (post: Post) => void;
  onOpenNote?: (post: Post) => void;
}

export default function TrendModal({ open, onClose, tag, onOpenFlash, onOpenPost, onOpenNote }: Props) {
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const [notes, setNotes] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'posts' | 'flashes' | 'notes'>('all');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.get(`/explore/search?tag=${encodeURIComponent(tag)}`)
      .then((r) => {
        setPosts(r.data.posts ?? []);
        setFlashes(r.data.flashes ?? []);
        setNotes(r.data.notes ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, tag]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  function mediaUrl(u: string) {
    return u.startsWith('http') ? u : `/uploads/${u}`;
  }

  const totalCount = posts.length + flashes.length + notes.length;

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 flex flex-col bg-white rounded-xl shadow-2xl ring-1 ring-black/10 animate-modal-enter overflow-hidden w-full max-w-[560px] mx-4"
        style={{ maxHeight: 'calc(100vh - 100px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-5 py-4 text-white shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Tendencia</p>
              <h2 className="mt-0.5 text-xl font-bold">{tag}</h2>
            </div>
            <button onClick={onClose} className="rounded-full bg-white/20 p-1.5 transition hover:bg-white/30">
              <X className="h-4 w-4" />
            </button>
          </div>
          {!loading && (
            <p className="mt-1 text-xs text-white/75">{totalCount} resultado{totalCount !== 1 ? 's' : ''}</p>
          )}
        </div>

        {/* Tabs */}
        {!loading && totalCount > 0 && (
          <div className="flex border-b border-gray-200 shrink-0">
            {(['all', 'posts', 'flashes', 'notes'] as const).map((t) => {
              const labels = { all: 'Todo', posts: 'Publicaciones', flashes: 'Flashes', notes: 'Notas' };
              const counts = { all: totalCount, posts: posts.length, flashes: flashes.length, notes: notes.length };
              if (t !== 'all' && counts[t] === 0) return null;
              return (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`flex-1 py-2.5 text-xs font-semibold transition ${activeTab === t ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {labels[t]} ({counts[t]})
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : totalCount === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <p className="text-sm">No se encontraron resultados para <b>{tag}</b></p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* Flashes */}
              {(activeTab === 'all' || activeTab === 'flashes') && flashes.map((f) => (
                <button
                  key={`f-${f.id}`}
                  onClick={() => { onClose(); onOpenFlash?.(f.id); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
                >
                  <Avatar src={f.user?.avatarUrl} alt={f.user?.displayName} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-600">
                        <Film className="h-3 w-3" /> Flash
                      </span>
                      <span className="text-xs text-gray-400">{timeAgo(f.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-800 truncate">{f.description || 'Sin descripción'}</p>
                    <p className="text-xs text-gray-400 truncate">@{f.user?.username}</p>
                  </div>
                </button>
              ))}

              {/* Posts */}
              {(activeTab === 'all' || activeTab === 'posts') && posts.map((p) => {
                const thumb = p.mediaUrls?.[0];
                const src = thumb ? mediaUrl(thumb) : null;
                const isVid = thumb?.match(/\.(mp4|webm|mov)$/i);
                return (
                  <button
                    key={`p-${p.id}`}
                    onClick={() => { onClose(); onOpenPost?.(p); }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
                  >
                    <Avatar src={p.user?.avatarUrl} alt={p.user?.displayName} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-600">
                          Publicación
                        </span>
                        <span className="text-xs text-gray-400">{timeAgo(p.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-gray-800 truncate">{p.content}</p>
                      <p className="text-xs text-gray-400 truncate">@{p.user?.username}</p>
                    </div>
                  </button>
                );
              })}

              {/* Notes */}
              {(activeTab === 'all' || activeTab === 'notes') && notes.map((n) => (
                <button
                  key={`n-${n.id}`}
                  onClick={() => { onClose(); onOpenNote?.(n); }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-gray-50"
                >
                  <Avatar src={n.user?.avatarUrl} alt={n.user?.displayName} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded bg-teal-50 px-1.5 py-0.5 text-[10px] font-bold text-teal-600">
                        <FileText className="h-3 w-3" /> Nota
                      </span>
                      <span className="text-xs text-gray-400">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-800 truncate">{n.content}</p>
                    <p className="text-xs text-gray-400 truncate">@{n.user?.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
