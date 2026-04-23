'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useInView } from 'react-intersection-observer';
import api from '@/lib/api';
import type { Post } from '@/lib/types';
import PostCard from '@/components/PostCard';
import StoriesBar from '@/components/StoriesBar';
import CreateStoryModal from '@/components/CreateStoryModal';
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
        {/* Stories bar */}
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm px-3">
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
    </>
  );
}
