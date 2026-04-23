'use client';

import { useEffect, useState, useRef, useCallback, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, Heart, Send, ChevronLeft, ChevronRight, Pause, Play, Trash2, Eye, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { StoryGroup, User } from '@/lib/types';
import Avatar from '@/components/Avatar';
import { timeAgo } from '@/lib/timeago';
import LoadingLogo from '@/components/LoadingLogo';

interface StoryViewer {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  viewedAt: string;
}

const IMAGE_DURATION = 5000;
const PROGRESS_INTERVAL = 50;

export default function StoriesPage() {
  const me = useAuthStore((s) => s.user);
  const router = useRouter();
  const searchParams = useSearchParams();
  const startUser = searchParams.get('user');

  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [groupIdx, setGroupIdx] = useState(0);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [viewers, setViewers] = useState<StoryViewer[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  // Fetch stories
  useEffect(() => {
    api.get('/stories/feed').then((r) => {
      const data: StoryGroup[] = r.data ?? [];
      setGroups(data);
      if (startUser && data.length > 0) {
        const idx = data.findIndex((g) => g.user.id === startUser);
        if (idx >= 0) setGroupIdx(idx);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [startUser]);

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];
  const isMe = group?.user.id === me?.id;

  const goClose = useCallback(() => {
    router.back();
  }, [router]);

  // Mark as viewed
  useEffect(() => {
    if (!story || story.viewed) return;
    api.post(`/stories/${story.id}/view`).catch(() => {});
    setGroups((prev) => {
      const next = [...prev];
      const g = { ...next[groupIdx], stories: [...next[groupIdx].stories] };
      g.stories[storyIdx] = { ...g.stories[storyIdx], viewed: true };
      next[groupIdx] = g;
      return next;
    });
  }, [story?.id, groupIdx, storyIdx]);

  const goNext = useCallback(() => {
    if (!group) return;
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx((s) => s + 1);
      setProgress(0);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((g) => g + 1);
      setStoryIdx(0);
      setProgress(0);
    } else {
      goClose();
    }
  }, [group, storyIdx, groupIdx, groups.length, goClose]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx((s) => s - 1);
      setProgress(0);
    } else if (groupIdx > 0) {
      setGroupIdx((g) => {
        const prevG = groups[g - 1];
        setStoryIdx(prevG.stories.length - 1);
        return g - 1;
      });
      setProgress(0);
    }
  }, [storyIdx, groupIdx, groups]);

  // Image timer
  useEffect(() => {
    if (!story || story.mediaType === 'video' || paused) return;
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const pct = Math.min((Date.now() - startTimeRef.current) / IMAGE_DURATION, 1);
      setProgress(pct);
      if (pct >= 1) {
        if (timerRef.current) clearInterval(timerRef.current);
        goNext();
      }
    }, PROGRESS_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [story?.id, story?.mediaType, paused, goNext]);

  // Video progress
  useEffect(() => {
    if (!story || story.mediaType !== 'video') return;
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
    const onTime = () => { if (v.duration) setProgress(v.currentTime / v.duration); };
    const onEnd = () => goNext();
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnd);
    return () => { v.removeEventListener('timeupdate', onTime); v.removeEventListener('ended', onEnd); v.pause(); };
  }, [story?.id, story?.mediaType, goNext]);

  // Pause/resume video
  useEffect(() => {
    if (story?.mediaType !== 'video') return;
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause(); else v.play().catch(() => {});
  }, [paused, story?.mediaType]);

  // Keyboard
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') goClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goClose, goNext, goPrev]);

  async function toggleLike() {
    if (!story) return;
    const liked = story.likedByMe;
    setGroups((prev) => {
      const next = [...prev];
      const g = { ...next[groupIdx], stories: [...next[groupIdx].stories] };
      g.stories[storyIdx] = { ...g.stories[storyIdx], likedByMe: !liked, likesCount: g.stories[storyIdx].likesCount + (liked ? -1 : 1) };
      next[groupIdx] = g;
      return next;
    });
    try {
      if (liked) await api.delete(`/stories/${story.id}/like`);
      else await api.post(`/stories/${story.id}/like`);
    } catch {
      setGroups((prev) => {
        const next = [...prev];
        const g = { ...next[groupIdx], stories: [...next[groupIdx].stories] };
        g.stories[storyIdx] = { ...g.stories[storyIdx], likedByMe: liked, likesCount: g.stories[storyIdx].likesCount + (liked ? 1 : -1) };
        next[groupIdx] = g;
        return next;
      });
    }
  }

  async function handleReply(e: FormEvent) {
    e.preventDefault();
    if (!reply.trim() || sending || !story) return;
    setSending(true);
    try {
      await api.post(`/stories/${story.id}/reply`, { message: reply.trim() });
      toast.success('Respuesta enviada');
      setReply('');
    } catch { toast.error('No se pudo enviar'); }
    setSending(false);
  }

  async function handleDelete() {
    if (!story) return;
    try {
      await api.delete(`/stories/${story.id}`);
      toast.success('Historia eliminada');
      setGroups((prev) => {
        const next = [...prev];
        const g = { ...next[groupIdx], stories: next[groupIdx].stories.filter((s) => s.id !== story.id) };
        if (g.stories.length === 0) {
          next.splice(groupIdx, 1);
          return next;
        }
        next[groupIdx] = g;
        return next;
      });
      if (group.stories.length <= 1) {
        if (groups.length <= 1) { goClose(); return; }
        if (groupIdx >= groups.length - 1) setGroupIdx((g) => Math.max(0, g - 1));
        setStoryIdx(0);
      } else {
        setStoryIdx((s) => Math.min(s, group.stories.length - 2));
      }
      setProgress(0);
      window.dispatchEvent(new Event('stories:refresh'));
    } catch { toast.error('No se pudo eliminar'); }
  }

  function jumpToGroup(idx: number) {
    setGroupIdx(idx);
    setStoryIdx(0);
    setProgress(0);
    setShowViewers(false);
  }

  // Fetch viewers when viewing own story
  useEffect(() => {
    if (!story || !isMe) { setViewers([]); return; }
    setLoadingViewers(true);
    api.get(`/stories/${story.id}/viewers`)
      .then((r) => setViewers(r.data ?? []))
      .catch(() => setViewers([]))
      .finally(() => setLoadingViewers(false));
  }, [story?.id, isMe]);

  function toggleViewers() {
    setShowViewers((v) => !v);
    setPaused(true);
  }

  // Loading
  if (!loaded) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-white">
        <LoadingLogo size="lg" />
      </div>
    );
  }

  // No stories
  if (groups.length === 0 || !group || !story) {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-white text-gray-600 gap-4">
        <p className="text-lg">No hay historias disponibles</p>
        <button onClick={goClose} className="rounded-full bg-gray-100 px-6 py-2 hover:bg-gray-200 transition text-gray-700">Volver</button>
      </div>
    );
  }

  const prevGroups = groups.slice(Math.max(0, groupIdx - 2), groupIdx);
  const nextGroups = groups.slice(groupIdx + 1, groupIdx + 3);

  return (
    <div className="fixed inset-0 z-[80] bg-white">
      {/* Close */}
      <button onClick={goClose} className="absolute top-4 right-4 z-30 rounded-full p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
        <X className="h-6 w-6" />
      </button>

      {/* Main story card — always centered */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-[420px] max-w-[90vw] h-[85vh] max-h-[780px] rounded-2xl overflow-hidden bg-black flex flex-col shadow-2xl pointer-events-auto">
          {/* Progress bars */}
          <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-3 pt-2">
            {group.stories.map((s, i) => (
              <div key={s.id} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
                <div className="h-full bg-white rounded-full" style={{ width: `${i < storyIdx ? 100 : i === storyIdx ? progress * 100 : 0}%`, transition: i === storyIdx ? 'none' : undefined }} />
              </div>
            ))}
          </div>

          {/* User header */}
          <div className="absolute top-6 left-0 right-0 z-20 flex items-center gap-3 px-4">
            <Avatar src={group.user.avatarUrl} alt={group.user.displayName} size={36} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{group.user.username}</p>
              <p className="text-[10px] text-white/60">{timeAgo(story.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPaused((p) => !p)} className="text-white/80 hover:text-white transition">
                {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </button>
              {isMe && (
                <button onClick={handleDelete} className="text-white/80 hover:text-red-400 transition">
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* Tap zones */}
          <div className="absolute inset-0 z-10 flex">
            <div className="w-1/3 h-full" onClick={goPrev} />
            <div className="w-1/3 h-full" onClick={() => setPaused((p) => !p)} />
            <div className="w-1/3 h-full" onClick={goNext} />
          </div>

          {/* Media */}
          <div className="flex-1 flex items-center justify-center bg-black">
            {story.mediaType === 'video' ? (
              <video ref={videoRef} src={story.mediaUrl} className="w-full h-full object-contain" playsInline muted={false} />
            ) : (
              <img src={story.mediaUrl} alt="" className="w-full h-full object-contain" />
            )}
          </div>

          {/* Viewers drawer (own story) */}
          {isMe && showViewers && (
            <div className="absolute bottom-0 left-0 right-0 z-30 bg-black/90 backdrop-blur rounded-t-2xl max-h-[50%] flex flex-col animate-in slide-in-from-bottom">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-white/70" />
                  <span className="text-sm font-semibold text-white">{viewers.length} {viewers.length === 1 ? 'vista' : 'vistas'}</span>
                </div>
                <button onClick={() => { setShowViewers(false); setPaused(false); }} className="text-white/60 hover:text-white transition">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2">
                {loadingViewers ? (
                  <div className="flex justify-center py-6">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-transparent" />
                  </div>
                ) : viewers.length === 0 ? (
                  <p className="text-center text-white/40 text-sm py-6">Nadie ha visto esta historia aún</p>
                ) : (
                  viewers.map((v) => (
                    <div key={v.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition">
                      <Avatar src={v.avatarUrl} alt={v.displayName} size={36} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{v.username}</p>
                        <p className="text-[10px] text-white/50">{timeAgo(v.viewedAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Bottom: reply + like (others) OR viewers button (own) */}
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/70 to-transparent pt-10 pb-4 px-4">
            <div className="flex items-center gap-3">
              {isMe ? (
                <button onClick={toggleViewers} className="flex-1 flex items-center gap-2 rounded-full border border-white/30 bg-white/10 backdrop-blur px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/20 transition">
                  <Eye className="h-4 w-4" />
                  <span>{loadingViewers ? '...' : `${viewers.length} ${viewers.length === 1 ? 'vista' : 'vistas'}`}</span>
                  <ChevronUp className={`h-4 w-4 ml-auto transition-transform ${showViewers ? 'rotate-180' : ''}`} />
                </button>
              ) : (
                <form onSubmit={handleReply} className="flex-1 flex items-center gap-2">
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Responder..."
                    maxLength={500}
                    className="flex-1 rounded-full border border-white/30 bg-white/10 backdrop-blur px-4 py-2 text-sm text-white placeholder-white/50 outline-none focus:border-white/60 transition"
                    onFocus={() => setPaused(true)}
                    onBlur={() => { if (!reply.trim()) setPaused(false); }}
                  />
                  <button type="submit" disabled={!reply.trim() || sending} className="rounded-full bg-primary-600 p-2 text-white disabled:opacity-40 transition hover:bg-primary-700">
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              )}
              <button onClick={toggleLike} className="shrink-0 transition-transform active:scale-125">
                <Heart className={`h-7 w-7 transition ${story.likedByMe ? 'fill-red-500 text-red-500' : 'text-white'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Prev arrow — positioned to the left of center card */}
      {(groupIdx > 0 || storyIdx > 0) && (
        <button onClick={goPrev} className="absolute top-1/2 -translate-y-1/2 z-20 rounded-full bg-gray-100 p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-200 transition shadow hidden md:flex" style={{ left: 'calc(50% - 230px)' }}>
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Next arrow — positioned to the right of center card */}
      {(storyIdx < group.stories.length - 1 || groupIdx < groups.length - 1) && (
        <button onClick={goNext} className="absolute top-1/2 -translate-y-1/2 z-20 rounded-full bg-gray-100 p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-200 transition shadow hidden md:flex" style={{ right: 'calc(50% - 230px)' }}>
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Left previews — anchored near the main card */}
      <div className="hidden lg:flex items-center gap-2 absolute top-1/2 -translate-y-1/2 z-10" style={{ right: 'calc(50% + 230px)' }}>
        {prevGroups.map((pg) => {
          const pgIdx = groups.findIndex((g) => g.user.id === pg.user.id);
          const ps = pg.stories[0];
          return (
            <button key={pg.user.id} onClick={() => jumpToGroup(pgIdx)} className="relative w-[110px] h-[180px] rounded-xl overflow-hidden bg-gray-100 shrink-0 opacity-60 hover:opacity-100 transition-opacity shadow">
              {ps.mediaType === 'video'
                ? <video src={ps.mediaUrl} className="w-full h-full object-cover" muted playsInline />
                : <img src={ps.mediaUrl} alt="" className="w-full h-full object-cover" />}
              <div className="absolute inset-0 bg-black/20" />
              <div className="absolute bottom-2 left-0 right-0 flex flex-col items-center gap-1">
                <div className={`rounded-full p-[2px] ${pg.hasUnviewed ? 'bg-gradient-to-tr from-fuchsia-500 via-rose-500 to-amber-400' : 'bg-gray-400'}`}>
                  <div className="rounded-full bg-white p-[1.5px]">
                    <Avatar src={pg.user.avatarUrl} alt={pg.user.displayName} size={28} />
                  </div>
                </div>
                <span className="text-[10px] text-white font-medium truncate max-w-[90px] drop-shadow">{pg.user.username}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Right previews — anchored near the main card */}
      <div className="hidden lg:flex items-center gap-2 absolute top-1/2 -translate-y-1/2 z-10" style={{ left: 'calc(50% + 230px)' }}>
        {nextGroups.map((ng) => {
          const ngIdx = groups.findIndex((g) => g.user.id === ng.user.id);
          const ns = ng.stories[0];
          return (
            <button key={ng.user.id} onClick={() => jumpToGroup(ngIdx)} className="relative w-[110px] h-[180px] rounded-xl overflow-hidden bg-gray-100 shrink-0 opacity-60 hover:opacity-100 transition-opacity shadow">
              {ns.mediaType === 'video'
                ? <video src={ns.mediaUrl} className="w-full h-full object-cover" muted playsInline />
                : <img src={ns.mediaUrl} alt="" className="w-full h-full object-cover" />}
              <div className="absolute inset-0 bg-black/20" />
              <div className="absolute bottom-2 left-0 right-0 flex flex-col items-center gap-1">
                <div className={`rounded-full p-[2px] ${ng.hasUnviewed ? 'bg-gradient-to-tr from-fuchsia-500 via-rose-500 to-amber-400' : 'bg-gray-400'}`}>
                  <div className="rounded-full bg-white p-[1.5px]">
                    <Avatar src={ng.user.avatarUrl} alt={ng.user.displayName} size={28} />
                  </div>
                </div>
                <span className="text-[10px] text-white font-medium truncate max-w-[90px] drop-shadow">{ng.user.username}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
