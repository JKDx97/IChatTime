'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useInView } from 'react-intersection-observer';
import { MessageCircle, PlusSquare, Heart, X, Image as ImageIcon, Film, Clock, FileText } from 'lucide-react';
import api from '@/lib/api';
import type { Post } from '@/lib/types';
import PostCard from '@/components/PostCard';
import StoriesBar from '@/components/StoriesBar';
import CreateStoryModal from '@/components/CreateStoryModal';
import CreatePostModal from '@/components/CreatePostModal';
import CreateFlashModal from '@/components/CreateFlashModal';
import CreateNoteModal from '@/components/CreateNoteModal';
import LoadingLogo from '@/components/LoadingLogo';

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);
  const { ref, inView } = useInView();
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showCreateFlash, setShowCreateFlash] = useState(false);
  const [showCreateNote, setShowCreateNote] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  useEffect(() => {
    api.get('/notifications/unread-count').then((r) => setUnreadNotifs(r.data.count)).catch(() => {});
  }, []);

  const fetchPosts = useCallback(async (c: string | null, reset: boolean) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const params = new URLSearchParams({ limit: '10' });
      if (c) params.set('cursor', c);
      const { data } = await api.get(`/posts/feed?${params}`);
      const items: Post[] = data.items ?? [];
      if (!data.nextCursor) setHasMore(false);
      setCursor(data.nextCursor);
      setPosts((prev) => (reset ? items : [...prev, ...items]));
    } catch { /* ignore */ }
    setLoading(false);
    fetchingRef.current = false;
  }, []);

  useEffect(() => { fetchPosts(null, true); }, [fetchPosts]);

  useEffect(() => {
    const handler = () => {
      setCursor(null);
      setHasMore(true);
      setLoading(true);
      fetchingRef.current = false;
      fetchPosts(null, true);
    };
    window.addEventListener('feed:refresh', handler);
    return () => window.removeEventListener('feed:refresh', handler);
  }, [fetchPosts]);

  useEffect(() => {
    if (inView && hasMore && !loading) {
      fetchPosts(cursor, false);
    }
  }, [inView, hasMore, loading, cursor, fetchPosts]);

  const handleDelete = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  if (loading && posts.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <LoadingLogo size="md" text="" />
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="py-20 text-center text-gray-400">
        <p className="text-lg font-medium">Aún no hay publicaciones</p>
        <p className="mt-1 text-sm">¡Sigue a personas o crea tu primera publicación!</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* ═══ Mobile top header ═══ */}
        <div className="flex items-center justify-between px-1 md:hidden">
          {/* Create button */}
          <button
            onClick={() => setCreateMenuOpen(true)}
            className="rounded-lg p-2 text-gray-800 transition hover:bg-gray-100 active:scale-90"
          >
            <PlusSquare className="h-6 w-6" strokeWidth={1.5} />
          </button>

          {/* Logo + Name */}
          <div className="flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary-600" />
            <span className="text-lg font-bold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">
              IChatTime
            </span>
          </div>

          {/* Notifications */}
          <button
            onClick={() => {
              setUnreadNotifs(0);
              window.dispatchEvent(new CustomEvent('open-notifications'));
            }}
            className="relative rounded-lg p-2 text-gray-800 transition hover:bg-gray-100 active:scale-90"
          >
            <Heart className="h-6 w-6" strokeWidth={1.5} />
            {unreadNotifs > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                {unreadNotifs > 99 ? '99+' : unreadNotifs}
              </span>
            )}
          </button>
        </div>

        {/* Stories bar */}
        <div className="px-3">
          <StoriesBar
            onViewStories={(_groups, idx) => {
              const userId = _groups[idx]?.user.id;
              router.push(userId ? `/stories?user=${userId}` : '/stories');
            }}
            onCreateStory={() => setShowCreateStory(true)}
          />
        </div>

        {posts.map((post) => (
          <PostCard key={post.id} post={post} onDelete={handleDelete} />
        ))}
        {hasMore && (
          <div ref={ref} className="flex justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
          </div>
        )}
      </div>

      <CreateStoryModal
        open={showCreateStory}
        onClose={() => setShowCreateStory(false)}
        onCreated={() => {
          window.dispatchEvent(new Event('stories:refresh'));
        }}
      />
      <CreatePostModal
        open={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onCreated={() => {
          window.dispatchEvent(new Event('feed:refresh'));
        }}
      />
      <CreateFlashModal
        open={showCreateFlash}
        onClose={() => setShowCreateFlash(false)}
      />
      <CreateNoteModal
        open={showCreateNote}
        onClose={() => setShowCreateNote(false)}
        onCreated={() => {
          window.dispatchEvent(new Event('feed:refresh'));
        }}
      />

      {/* Mobile create bottom sheet */}
      {createMenuOpen && (
        <div className="fixed inset-0 z-[9999] md:hidden" onClick={() => setCreateMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/40 animate-fade-in" />
          <div
            className="fixed inset-x-0 bottom-0 z-[9999] bg-white rounded-t-2xl shadow-2xl animate-slide-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2 pb-1"><div className="h-1 w-10 rounded-full bg-gray-300" /></div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Crear</h3>
              <button onClick={() => setCreateMenuOpen(false)} className="rounded-full p-1 hover:bg-gray-100 transition"><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div className="py-2 pb-6 safe-area-bottom">
              <button onClick={() => { setCreateMenuOpen(false); setShowCreatePost(true); }} className="flex w-full items-center gap-4 px-5 py-3 transition active:bg-gray-50">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><ImageIcon className="h-5 w-5" /></div>
                <div className="text-left"><p className="font-semibold text-gray-900">Publicación</p><p className="text-xs text-gray-400">Comparte fotos y videos</p></div>
              </button>
              <button onClick={() => { setCreateMenuOpen(false); setShowCreateNote(true); }} className="flex w-full items-center gap-4 px-5 py-3 transition active:bg-gray-50">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600"><FileText className="h-5 w-5" /></div>
                <div className="text-left"><p className="font-semibold text-gray-900">Nota</p><p className="text-xs text-gray-400">Escribe una nota de texto</p></div>
              </button>
              <button onClick={() => { setCreateMenuOpen(false); setShowCreateFlash(true); }} className="flex w-full items-center gap-4 px-5 py-3 transition active:bg-gray-50">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Film className="h-5 w-5" /></div>
                <div className="text-left"><p className="font-semibold text-gray-900">Flash</p><p className="text-xs text-gray-400">Video corto estilo reel</p></div>
              </button>
              <button onClick={() => { setCreateMenuOpen(false); setShowCreateStory(true); }} className="flex w-full items-center gap-4 px-5 py-3 transition active:bg-gray-50">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-50 text-fuchsia-600"><Clock className="h-5 w-5" /></div>
                <div className="text-left"><p className="font-semibold text-gray-900">Historia</p><p className="text-xs text-gray-400">Desaparece en 24h</p></div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
