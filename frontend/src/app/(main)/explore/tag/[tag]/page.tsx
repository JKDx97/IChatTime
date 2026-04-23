'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Hash, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import type { Post } from '@/lib/types';
import PostCard from '@/components/PostCard';

export default function TagPage() {
  const { tag } = useParams<{ tag: string }>();
  const router = useRouter();
  const decodedTag = decodeURIComponent(tag);

  const [loading, setLoading] = useState(true);
  const [allPosts, setAllPosts] = useState<Post[]>([]);

  useEffect(() => {
    setLoading(true);
    api.get(`/explore/search?tag=${encodeURIComponent(decodedTag)}`)
      .then((r) => {
        const posts: Post[] = r.data.posts ?? [];
        const notes: Post[] = r.data.notes ?? [];
        const merged = [...posts, ...notes].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setAllPosts(merged);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [decodedTag]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-5 py-5 text-white">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/explore')}
              className="rounded-full bg-white/20 p-2 transition hover:bg-white/30"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Tendencia</p>
              <h1 className="mt-0.5 text-2xl font-bold truncate">{decodedTag}</h1>
            </div>
          </div>
          {!loading && (
            <p className="mt-2 text-sm text-white/75">
              {allPosts.length} resultado{allPosts.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : allPosts.length === 0 ? (
        <div className="card py-20 text-center">
          <Hash className="mx-auto mb-3 h-12 w-12 text-gray-300" strokeWidth={1.2} />
          <p className="text-lg font-medium text-gray-700">Sin resultados</p>
          <p className="mt-1 text-sm text-gray-400">No se encontraron publicaciones para <b>{decodedTag}</b></p>
        </div>
      ) : (
        <div className="space-y-4">
          {allPosts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}
