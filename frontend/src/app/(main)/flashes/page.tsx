'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Heart, MessageCircle, Volume2, VolumeX, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { Flash } from '@/lib/types';
import Avatar from '@/components/Avatar';
import FlashCommentsModal from '@/components/FlashCommentsModal';
import { timeAgo } from '@/lib/timeago';
import LoadingLogo from '@/components/LoadingLogo';

export default function FlashesPage() {
  const me = useAuthStore((s) => s.user);
  const searchParams = useSearchParams();
  const targetId = searchParams.get('id');
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [commentFlash, setCommentFlash] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const didInitRef = useRef(false);

  const fetchFlashes = useCallback(async (currentOffset: number, reset: boolean) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const { data } = await api.get(`/flashes/random?limit=10&offset=${currentOffset}`);
      const items: Flash[] = data.items ?? [];
      setHasMore(data.hasMore ?? false);
      setOffset(currentOffset + items.length);
      setFlashes((prev) => {
        if (reset) return items;
        const existingIds = new Set(prev.map((f) => f.id));
        const newItems = items.filter((f) => !existingIds.has(f.id));
        return [...prev, ...newItems];
      });
    } catch { /* ignore */ }
    setLoading(false);
    fetchingRef.current = false;
  }, []);

  // Initial load: if ?id= is present, fetch that flash first then load feed
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    (async () => {
      if (targetId) {
        try {
          const { data: target } = await api.get(`/flashes/${targetId}`);
          setFlashes([target]);
          setLoading(false);
          // Then load more in background
          fetchingRef.current = false;
          const { data: feed } = await api.get('/flashes/random?limit=10&offset=0');
          const feedItems: Flash[] = (feed.items ?? []).filter((f: Flash) => f.id !== targetId);
          setHasMore(feed.hasMore ?? false);
          setOffset(feedItems.length);
          setFlashes((prev) => [...prev, ...feedItems]);
        } catch {
          // Fallback to normal feed
          await fetchFlashes(0, true);
        }
      } else {
        await fetchFlashes(0, true);
      }
    })();
  }, [targetId, fetchFlashes]);

  // Snap scroll observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.getAttribute('data-index'));
            if (!isNaN(idx)) setActiveIndex(idx);
          }
        });
      },
      { root: container, threshold: 0.6 },
    );

    const items = container.querySelectorAll('[data-index]');
    items.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [flashes]);

  // Load more when near end
  useEffect(() => {
    if (activeIndex >= flashes.length - 3 && hasMore && !loading) {
      fetchFlashes(offset, false);
    }
  }, [activeIndex, flashes.length, hasMore, loading, offset, fetchFlashes]);

  async function toggleLike(flash: Flash) {
    try {
      if (flash.likedByMe) {
        await api.delete(`/flashes/${flash.id}/like`);
        setFlashes((prev) =>
          prev.map((f) =>
            f.id === flash.id ? { ...f, likedByMe: false, likesCount: f.likesCount - 1 } : f,
          ),
        );
      } else {
        await api.post(`/flashes/${flash.id}/like`);
        setFlashes((prev) =>
          prev.map((f) =>
            f.id === flash.id ? { ...f, likedByMe: true, likesCount: f.likesCount + 1 } : f,
          ),
        );
      }
    } catch {
      toast.error('Error');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este flash?')) return;
    try {
      await api.delete(`/flashes/${id}`);
      setFlashes((prev) => prev.filter((f) => f.id !== id));
      toast.success('Flash eliminado');
    } catch {
      toast.error('No se pudo eliminar');
    }
  }

  function handleCommentCountChange(flashId: string, delta: number) {
    setFlashes((prev) =>
      prev.map((f) =>
        f.id === flashId ? { ...f, commentsCount: f.commentsCount + delta } : f,
      ),
    );
  }

  if (loading && flashes.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <LoadingLogo size="md" text="" />
      </div>
    );
  }

  if (flashes.length === 0) {
    return (
      <div className="py-20 text-center text-gray-400">
        <p className="text-lg font-medium">No hay Flashes aún ⚡</p>
        <p className="mt-1 text-sm">¡Sé el primero en subir uno desde Crear!</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-64px)] md:h-[calc(100vh-48px)] -mx-4 -mt-6 -mb-20 md:mx-0 md:mt-0 md:mb-0">
      {/* Video feed area */}
      <div
        ref={containerRef}
        className="flex-1 min-w-0 overflow-y-scroll snap-y snap-mandatory scrollbar-hide transition-all duration-300"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {flashes.map((flash, idx) => (
          <FlashCard
            key={flash.id}
            flash={flash}
            index={idx}
            isActive={idx === activeIndex}
            muted={muted}
            onToggleMute={() => setMuted(!muted)}
            onLike={() => toggleLike(flash)}
            onComment={() => setCommentFlash(flash.id)}
            onDelete={flash.userId === me?.id ? () => handleDelete(flash.id) : undefined}
            commentsOpen={!!commentFlash}
          />
        ))}
      </div>

      {/* Comments side panel (inline, not overlay) */}
      {commentFlash && (
        <FlashCommentsModal
          flashId={commentFlash}
          flashOwnerId={flashes.find((f) => f.id === commentFlash)?.user?.id}
          open={!!commentFlash}
          onClose={() => setCommentFlash(null)}
          onCountChange={(d) => handleCommentCountChange(commentFlash, d)}
        />
      )}
    </div>
  );
}

/* ─── Individual Flash Card ─────────────────────── */
function FlashCard({
  flash,
  index,
  isActive,
  muted,
  onToggleMute,
  onLike,
  onComment,
  onDelete,
  commentsOpen,
}: {
  flash: Flash;
  index: number;
  isActive: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onLike: () => void;
  onComment: () => void;
  onDelete?: () => void;
  commentsOpen?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [likeAnim, setLikeAnim] = useState(false);

  // Play/pause based on active state
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.currentTime = 0;
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [isActive]);

  // Mute sync
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  function handleDoubleTap() {
    if (!flash.likedByMe) {
      onLike();
      setLikeAnim(true);
      setTimeout(() => setLikeAnim(false), 800);
    }
  }

  function getVideoUrl(url: string) {
    return url.startsWith('http') ? url : `/uploads/${url}`;
  }

  return (
    <div
      data-index={index}
      className="relative h-[calc(100dvh-64px)] md:h-[calc(100vh-48px)] snap-start snap-always flex items-center justify-center bg-black"
    >
      {/* Video */}
      <video
        ref={videoRef}
        src={getVideoUrl(flash.videoUrl)}
        loop
        playsInline
        muted={muted}
        preload="auto"
        onDoubleClick={handleDoubleTap}
        className="h-full w-full max-w-[440px] mx-auto object-contain cursor-pointer"
      />

      {/* Double-tap like animation */}
      {likeAnim && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Heart className="h-24 w-24 text-red-500 fill-red-500 animate-ping" />
        </div>
      )}

      {/* Right sidebar actions */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
        {/* Like */}
        <button onClick={onLike} className="flex flex-col items-center gap-1 group">
          <div className={`rounded-full p-2.5 transition ${flash.likedByMe ? 'text-red-500' : 'text-white'} bg-black/30 backdrop-blur-sm group-active:scale-90`}>
            <Heart className={`h-6 w-6 ${flash.likedByMe ? 'fill-red-500' : ''}`} />
          </div>
          <span className="text-xs font-bold text-white drop-shadow">{flash.likesCount}</span>
        </button>

        {/* Comment */}
        <button onClick={onComment} className="flex flex-col items-center gap-1 group">
          <div className="rounded-full p-2.5 text-white bg-black/30 backdrop-blur-sm group-active:scale-90 transition">
            <MessageCircle className="h-6 w-6" />
          </div>
          <span className="text-xs font-bold text-white drop-shadow">{flash.commentsCount}</span>
        </button>

        {/* Mute toggle */}
        <button onClick={onToggleMute} className="rounded-full p-2.5 text-white bg-black/30 backdrop-blur-sm active:scale-90 transition">
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>

        {/* Delete (own flashes) */}
        {onDelete && (
          <button onClick={onDelete} className="rounded-full p-2.5 text-white bg-black/30 backdrop-blur-sm active:scale-90 transition hover:bg-red-600/60">
            <Trash2 className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Bottom: user info + description */}
      <div className="absolute left-0 right-16 bottom-4 px-4">
        <Link href={`/profile/${flash.user.username}`} className="flex items-center gap-2 mb-2">
          <Avatar src={flash.user.avatarUrl} alt={flash.user.displayName} size={36} />
          <div>
            <p className="text-sm font-bold text-white drop-shadow">{flash.user.username}</p>
            <p className="text-[10px] text-white/60">{timeAgo(flash.createdAt)}</p>
          </div>
        </Link>
        {flash.description && (
          <p className="text-sm text-white drop-shadow-lg leading-snug line-clamp-3">
            {flash.description}
          </p>
        )}
      </div>
    </div>
  );
}
