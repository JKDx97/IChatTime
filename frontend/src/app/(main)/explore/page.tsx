'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Compass, TrendingUp, Hash, Play, RefreshCw, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import type { Flash } from '@/lib/types';
import Avatar from '@/components/Avatar';

interface TrendItem {
  tag: string;
  count: number;
}

export default function ExplorePage() {
  const router = useRouter();
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [loadingFlashes, setLoadingFlashes] = useState(true);
  const [loadingTrends, setLoadingTrends] = useState(true);


  const fetchFlashes = useCallback(async () => {
    setLoadingFlashes(true);
    try {
      const { data } = await api.get('/explore/flashes?limit=9');
      setFlashes(data);
    } catch { /* ignore */ }
    setLoadingFlashes(false);
  }, []);

  const fetchTrends = useCallback(async () => {
    setLoadingTrends(true);
    try {
      const { data } = await api.get('/explore/trending?limit=15');
      setTrends(data);
    } catch { /* ignore */ }
    setLoadingTrends(false);
  }, []);

  useEffect(() => {
    fetchFlashes();
    fetchTrends();
  }, [fetchFlashes, fetchTrends]);

  function goToFlash(flashId: string) {
    router.push(`/flashes?id=${flashId}`);
  }

  function mediaUrl(u: string) {
    return u.startsWith('http') ? u : `/uploads/${u}`;
  }

  // Build grid groups of 3: left tall rectangle + 2 right squares
  const gridGroups: Flash[][] = [];
  for (let i = 0; i < flashes.length; i += 3) {
    gridGroups.push(flashes.slice(i, i + 3));
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-5 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/80">
                <Compass className="h-4 w-4" /> Descubrir
              </div>
              <h1 className="mt-1 text-2xl font-bold">Explorar</h1>
              <p className="mt-0.5 text-sm text-white/80">Flashes populares y tendencias del día</p>
            </div>
            <button
              onClick={() => { fetchFlashes(); fetchTrends(); }}
              className="rounded-full bg-white/20 p-2.5 transition hover:bg-white/30 active:scale-90"
              title="Refrescar"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main layout: flashes grid + trends sidebar */}
      <div className="flex gap-5 flex-col lg:flex-row">
        {/* Flashes Grid */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <Play className="h-4 w-4 text-amber-500 fill-amber-500" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Flashes</h2>
          </div>

          {loadingFlashes ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : flashes.length === 0 ? (
            <div className="card py-16 text-center text-gray-400">
              <Play className="mx-auto mb-2 h-10 w-10" strokeWidth={1.2} />
              <p className="text-sm">No hay flashes aún</p>
            </div>
          ) : (
            <div className="space-y-2">
              {gridGroups.map((group, gi) => {
                const isReversed = gi % 2 === 1;
                const tall = group[0];
                const sq1 = group[1];
                const sq2 = group[2];

                const tallCard = (flash: Flash) => (
                  <button
                    key={flash.id}
                    onClick={() => goToFlash(flash.id)}
                    className="relative w-full h-full overflow-hidden rounded-xl bg-gray-900 group"
                  >
                    <video
                      src={mediaUrl(flash.videoUrl)}
                      muted
                      playsInline
                      preload="metadata"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <div className="flex items-center gap-2">
                        <Avatar src={flash.user?.avatarUrl} alt={flash.user?.displayName} size={24} />
                        <span className="text-xs font-semibold text-white truncate">@{flash.user?.username}</span>
                      </div>
                      {flash.description && (
                        <p className="mt-1 text-xs text-white/80 line-clamp-2">{flash.description}</p>
                      )}
                    </div>
                    <div className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5">
                      <Play className="h-3 w-3 text-white fill-white" />
                    </div>
                  </button>
                );

                const squareCard = (flash: Flash) => (
                  <button
                    key={flash.id}
                    onClick={() => goToFlash(flash.id)}
                    className="relative w-full h-full overflow-hidden rounded-xl bg-gray-900 group"
                  >
                    <video
                      src={mediaUrl(flash.videoUrl)}
                      muted
                      playsInline
                      preload="metadata"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2.5">
                      <div className="flex items-center gap-1.5">
                        <Avatar src={flash.user?.avatarUrl} alt={flash.user?.displayName} size={18} />
                        <span className="text-[11px] font-semibold text-white truncate">@{flash.user?.username}</span>
                      </div>
                    </div>
                    <div className="absolute right-1.5 top-1.5 rounded-full bg-black/50 p-1">
                      <Play className="h-2.5 w-2.5 text-white fill-white" />
                    </div>
                  </button>
                );

                const leftCol = isReversed ? (
                  <div className="flex flex-col gap-2">
                    {sq1 && squareCard(sq1)}
                    {sq2 && squareCard(sq2)}
                  </div>
                ) : (
                  tallCard(tall)
                );

                const rightCol = isReversed ? (
                  tallCard(tall)
                ) : (
                  <div className="flex flex-col gap-2">
                    {sq1 && squareCard(sq1)}
                    {sq2 && squareCard(sq2)}
                  </div>
                );

                return (
                  <div key={gi} className="grid grid-cols-2 gap-2" style={{ height: 360 }}>
                    {leftCol}
                    {rightCol}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Trending Sidebar */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="card overflow-hidden sticky top-4">
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <h2 className="text-sm font-bold">Tendencias del día</h2>
              </div>
            </div>

            {loadingTrends ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : trends.length === 0 ? (
              <div className="py-10 text-center">
                <Hash className="mx-auto mb-2 h-8 w-8 text-gray-300" strokeWidth={1.2} />
                <p className="text-xs text-gray-400">Aún no hay tendencias hoy</p>
                <p className="mt-1 text-[11px] text-gray-300">Usa hashtags en tus publicaciones</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {trends.map((t, i) => (
                  <button
                    key={t.tag}
                    onClick={() => router.push(`/explore/tag/${encodeURIComponent(t.tag)}`)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-gray-50 active:bg-gray-100"
                  >
                    <span className="text-xs font-bold text-gray-300 w-5 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{t.tag}</p>
                      <p className="text-[11px] text-gray-400">{t.count} {t.count === 1 ? 'publicación' : 'publicaciones'}</p>
                    </div>
                    <Hash className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
