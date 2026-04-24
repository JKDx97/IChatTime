'use client';

import { useState, useRef, useEffect, memo } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Trash2, Bookmark, ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import { timeAgo, formatExactDate } from '@/lib/timeago';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { Post } from '@/lib/types';
import Avatar from './Avatar';
import PostDetailModal from './PostDetailModal';
import NoteDetailModal from './NoteDetailModal';
import { renderHashtags } from '@/lib/renderHashtags';

interface Props {
  post: Post;
  onDelete?: (id: string) => void;
}

export default memo(function PostCard({ post, onDelete }: Props) {
  const me = useAuthStore((s) => s.user);
  const [liked, setLiked] = useState(post.likedByMe);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [saved, setSaved] = useState(post.savedByMe ?? false);
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [mediaIdx, setMediaIdx] = useState(0);
  const touchStartX = useRef(0);
  const feedVideoTimeRef = useRef(0);
  const modalVideoTimeRef = useRef(0);

  async function toggleLike() {
    if (busy) return;
    setBusy(true);
    try {
      if (liked) {
        await api.delete(`/posts/${post.id}/like`);
        setLiked(false);
        setLikesCount((c) => c - 1);
      } else {
        await api.post(`/posts/${post.id}/like`);
        setLiked(true);
        setLikesCount((c) => c + 1);
      }
    } catch {
      toast.error('Acción fallida');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar esta publicación?')) return;
    try {
      await api.delete(`/posts/${post.id}`);
      onDelete?.(post.id);
      toast.success('Publicación eliminada');
    } catch {
      toast.error('No se pudo eliminar la publicación');
    }
  }

  async function toggleSave() {
    if (busy) return;
    setBusy(true);
    try {
      if (saved) {
        await api.delete(`/posts/${post.id}/save`);
        setSaved(false);
      } else {
        await api.post(`/posts/${post.id}/save`);
        setSaved(true);
      }
    } catch {
      toast.error('Acción fallida');
    } finally {
      setBusy(false);
    }
  }

  function handlePostUpdate(updated: Post) {
    setLiked(updated.likedByMe);
    setLikesCount(updated.likesCount);
    setCommentsCount(updated.commentsCount);
    if (updated.savedByMe !== undefined) setSaved(updated.savedByMe);
  }

  function handleModalDelete(id: string) {
    setModalOpen(false);
    onDelete?.(id);
  }

  const currentPost: Post = { ...post, likedByMe: liked, likesCount, commentsCount, savedByMe: saved };

  return (
    <article className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Link href={`/profile/${post.user.username}`}>
          <Avatar src={post.user.avatarUrl} alt={post.user.displayName} size={36} />
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/profile/${post.user.username}`} className="text-sm font-semibold text-gray-900 hover:underline">
            {post.user.displayName}
          </Link>
          <p className="text-xs text-gray-400">
            @{post.user.username} &middot; <span title={formatExactDate(post.createdAt)}>{timeAgo(post.createdAt)}</span>
          </p>
        </div>
        {me?.id === post.user.id && (
          <button onClick={handleDelete} className="rounded p-1 text-gray-400 hover:text-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Media carousel */}
      {post.mediaUrls?.length > 0 && (() => {
        const urls = post.mediaUrls;
        const total = urls.length;
        const currentUrl = urls[mediaIdx] ?? urls[0];
        const src = currentUrl.startsWith('http') ? currentUrl : `/uploads/${currentUrl}`;
        const isVid = currentUrl.match(/\.(mp4|webm|mov)$/i);
        return (
          <div className="relative">
            <button
              onClick={() => setModalOpen(true)}
              onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                const dx = e.changedTouches[0].clientX - touchStartX.current;
                if (dx < -50 && mediaIdx < total - 1) setMediaIdx(mediaIdx + 1);
                if (dx > 50 && mediaIdx > 0) setMediaIdx(mediaIdx - 1);
              }}
              className="relative w-full bg-gray-100 cursor-pointer block"
            >
              {isVid ? (
                <FeedVideo src={src} paused={modalOpen} seekTo={feedVideoTimeRef.current} onTimeRef={(t) => { feedVideoTimeRef.current = t; }} />
              ) : (
                <img src={src} alt="Publicación" className="w-full max-h-[600px] object-contain bg-black" />
              )}
              {total > 1 && (
                <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
                  {mediaIdx + 1}/{total}
                </div>
              )}
            </button>
            {/* Arrow buttons for multi-media */}
            {total > 1 && mediaIdx > 0 && (
              <button
                onClick={() => setMediaIdx(mediaIdx - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1 text-white transition hover:bg-black/70 active:scale-90"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {total > 1 && mediaIdx < total - 1 && (
              <button
                onClick={() => setMediaIdx(mediaIdx + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1 text-white transition hover:bg-black/70 active:scale-90"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
            {/* Dots */}
            {total > 1 && (
              <div className="flex justify-center gap-1.5 py-2">
                {urls.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setMediaIdx(i)}
                    className={`h-1.5 rounded-full transition-all ${i === mediaIdx ? 'w-4 bg-primary-600' : 'w-1.5 bg-gray-300'}`}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 py-2.5">
        <button onClick={toggleLike} className="flex items-center gap-1.5 text-sm transition">
          <Heart className={`h-5 w-5 ${liked ? 'fill-red-500 text-red-500' : 'text-gray-600 hover:text-red-500'}`} />
          <span className={liked ? 'font-semibold text-red-500' : 'text-gray-600'}>{likesCount}</span>
        </button>
        <button onClick={() => setModalOpen(true)} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary-600 transition">
          <MessageCircle className="h-5 w-5" />
          <span>{commentsCount}</span>
        </button>
        <div className="flex-1" />
        <button onClick={toggleSave} className="transition active:scale-90">
          <Bookmark className={`h-5 w-5 ${saved ? 'fill-gray-900 text-gray-900' : 'text-gray-600 hover:text-gray-900'}`} />
        </button>
      </div>

      {/* Caption */}
      {post.content && (
        <div className="px-4 pb-3">
          <p className="text-sm">
            <Link href={`/profile/${post.user.username}`} className="font-semibold hover:underline">
              {post.user.username}
            </Link>{' '}
            {renderHashtags(post.content)}
          </p>
        </div>
      )}

      {/* Modal de detalle */}
      {modalOpen && (
        (currentPost.mediaUrls?.length ?? 0) === 0 ? (
          <NoteDetailModal
            post={currentPost}
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onPostUpdate={handlePostUpdate}
            onDelete={onDelete ? handleModalDelete : undefined}
          />
        ) : (
          <PostDetailModal
            post={currentPost}
            open={modalOpen}
            onClose={() => {
              feedVideoTimeRef.current = modalVideoTimeRef.current;
              setModalOpen(false);
            }}
            onPostUpdate={handlePostUpdate}
            onDelete={onDelete ? handleModalDelete : undefined}
            videoStartTime={feedVideoTimeRef.current}
            onVideoTimeSync={(t) => { modalVideoTimeRef.current = t; }}
          />
        )
      )}
    </article>
  );
})

/* ─── Auto-play video when visible in feed ─── */
function FeedVideo({ src, paused: externalPaused, seekTo, onTimeRef }: { src: string; paused?: boolean; seekTo?: number; onTimeRef?: (t: number) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.setAttribute('muted', '');
    v.setAttribute('webkit-playsinline', 'true');
    v.setAttribute('playsinline', '');
    v.play().catch(() => {});
  }, []);

  // Report currentTime continuously so modal can sync
  useEffect(() => {
    const v = ref.current;
    if (!v || !onTimeRef) return;
    const handler = () => onTimeRef(v.currentTime);
    v.addEventListener('timeupdate', handler);
    return () => v.removeEventListener('timeupdate', handler);
  }, [onTimeRef]);

  // Pause/resume based on external state (modal open)
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (externalPaused) {
      v.pause();
    } else {
      // Resuming: seek to the time from modal
      if (seekTo !== undefined && seekTo > 0) v.currentTime = seekTo;
      v.muted = true;
      v.play().catch(() => {});
    }
  }, [externalPaused]);

  useEffect(() => {
    const container = containerRef.current;
    const v = ref.current;
    if (!container || !v) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !externalPaused) {
          v.muted = true;
          v.play().catch(() => {});
        } else {
          v.pause();
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [externalPaused]);

  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation();
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  return (
    <div ref={containerRef} className="relative w-full bg-black">
      <video
        ref={ref}
        src={src}
        loop
        muted
        playsInline
        autoPlay
        preload="auto"
        className="w-full max-h-[600px] object-contain pointer-events-none"
      />
      <button
        onClick={toggleMute}
        className="absolute right-2 bottom-2 z-10 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm transition active:scale-90 hover:bg-black/70"
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>
    </div>
  );
}
