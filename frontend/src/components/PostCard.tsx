'use client';

import { useState, useRef, memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, MessageCircle, Trash2, Bookmark, ChevronLeft, ChevronRight } from 'lucide-react';
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
                <video src={src} muted playsInline preload="metadata" className="w-full pointer-events-none" />
              ) : (
                <div className="relative aspect-square">
                  <Image src={src} alt="Publicación" fill className="object-cover" sizes="(max-width: 768px) 100vw, 672px" />
                </div>
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
            onClose={() => setModalOpen(false)}
            onPostUpdate={handlePostUpdate}
            onDelete={onDelete ? handleModalDelete : undefined}
          />
        )
      )}
    </article>
  );
})
