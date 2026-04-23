'use client';

import { useEffect, useState, useRef, useCallback, FormEvent } from 'react';
import { X, Heart, Send, ChevronLeft, ChevronRight, Pause, Play, Trash2, Eye, ChevronUp, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { StoryGroup, StoryItem } from '@/lib/types';
import Avatar from './Avatar';
import { timeAgo } from '@/lib/timeago';

const IMAGE_DURATION = 5000; // 5s per image
const PROGRESS_INTERVAL = 50;

interface Props {
  groups: StoryGroup[];
  startGroupIndex: number;
  onClose: () => void;
}

export default function StoryViewer({ groups, startGroupIndex, onClose }: Props) {
  const me = useAuthStore((s) => s.user);
  const [groupIdx, setGroupIdx] = useState(startGroupIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [localGroups, setLocalGroups] = useState(groups);
  const [viewers, setViewers] = useState<{ id: string; username: string; displayName: string; avatarUrl: string | null; viewedAt: string }[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const durationRef = useRef(IMAGE_DURATION);

  const group = localGroups[groupIdx];
  const story = group?.stories[storyIdx];
  const isMe = group?.user.id === me?.id;

  // Mark as viewed
  useEffect(() => {
    if (!story || story.viewed) return;
    api.post(`/stories/${story.id}/view`).catch(() => {});
    setLocalGroups((prev) => {
      const next = [...prev];
      const g = { ...next[groupIdx], stories: [...next[groupIdx].stories] };
      g.stories[storyIdx] = { ...g.stories[storyIdx], viewed: true };
      next[groupIdx] = g;
      return next;
    });
  }, [story?.id, groupIdx, storyIdx]);

  // Fetch viewers when owner views their own story
  useEffect(() => {
    if (!story || !isMe) { setViewers([]); return; }
    setLoadingViewers(true);
    api.get(`/stories/${story.id}/viewers`)
      .then((r) => setViewers(r.data ?? []))
      .catch(() => setViewers([]))
      .finally(() => setLoadingViewers(false));
  }, [story?.id, isMe]);

  const goNext = useCallback(() => {
    if (!group) return;
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx(storyIdx + 1);
      setProgress(0);
    } else if (groupIdx < localGroups.length - 1) {
      setGroupIdx(groupIdx + 1);
      setStoryIdx(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [group, storyIdx, groupIdx, localGroups.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx(storyIdx - 1);
      setProgress(0);
    } else if (groupIdx > 0) {
      setGroupIdx(groupIdx - 1);
      const prevGroup = localGroups[groupIdx - 1];
      setStoryIdx(prevGroup.stories.length - 1);
      setProgress(0);
    }
  }, [storyIdx, groupIdx, localGroups]);

  // Progress timer for images
  useEffect(() => {
    if (!story) return;
    if (story.mediaType === 'video') return; // video handles its own progress
    if (paused) return;

    startTimeRef.current = Date.now();
    durationRef.current = IMAGE_DURATION;

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(elapsed / durationRef.current, 1);
      setProgress(pct);
      if (pct >= 1) {
        if (timerRef.current) clearInterval(timerRef.current);
        goNext();
      }
    }, PROGRESS_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [story?.id, story?.mediaType, paused, goNext]);

  // Video progress
  useEffect(() => {
    if (!story || story.mediaType !== 'video') return;
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});

    const onTimeUpdate = () => {
      if (v.duration) setProgress(v.currentTime / v.duration);
    };
    const onEnded = () => goNext();

    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('ended', onEnded);
    return () => {
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('ended', onEnded);
      v.pause();
    };
  }, [story?.id, story?.mediaType, goNext]);

  // Pause/resume video
  useEffect(() => {
    if (story?.mediaType !== 'video') return;
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause();
    else v.play().catch(() => {});
  }, [paused, story?.mediaType]);

  // Keyboard
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goNext, goPrev]);

  async function toggleLike() {
    if (!story) return;
    const liked = story.likedByMe;
    // Optimistic
    setLocalGroups((prev) => {
      const next = [...prev];
      const g = { ...next[groupIdx], stories: [...next[groupIdx].stories] };
      g.stories[storyIdx] = {
        ...g.stories[storyIdx],
        likedByMe: !liked,
        likesCount: g.stories[storyIdx].likesCount + (liked ? -1 : 1),
      };
      next[groupIdx] = g;
      return next;
    });
    try {
      if (liked) await api.delete(`/stories/${story.id}/like`);
      else await api.post(`/stories/${story.id}/like`);
    } catch {
      // Revert
      setLocalGroups((prev) => {
        const next = [...prev];
        const g = { ...next[groupIdx], stories: [...next[groupIdx].stories] };
        g.stories[storyIdx] = {
          ...g.stories[storyIdx],
          likedByMe: liked,
          likesCount: g.stories[storyIdx].likesCount + (liked ? 1 : -1),
        };
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
    } catch {
      toast.error('No se pudo enviar');
    }
    setSending(false);
  }

  async function handleDelete() {
    if (!story) return;
    try {
      await api.delete(`/stories/${story.id}`);
      toast.success('Historia eliminada');
      // Remove from local state
      setLocalGroups((prev) => {
        const next = [...prev];
        const g = { ...next[groupIdx], stories: next[groupIdx].stories.filter((s) => s.id !== story.id) };
        next[groupIdx] = g;
        return next;
      });
      if (group.stories.length <= 1) {
        // No more stories in this group
        if (groupIdx < localGroups.length - 1) {
          setStoryIdx(0);
          setProgress(0);
        } else {
          onClose();
        }
      } else {
        setStoryIdx(Math.min(storyIdx, group.stories.length - 2));
        setProgress(0);
      }
      window.dispatchEvent(new Event('stories:refresh'));
    } catch {
      toast.error('No se pudo eliminar');
    }
  }

  // Nearby groups for previews (up to 2 on each side)
  const prevGroups = localGroups.slice(Math.max(0, groupIdx - 2), groupIdx);
  const nextGroups = localGroups.slice(groupIdx + 1, groupIdx + 3);

  function jumpToGroup(idx: number) {
    setGroupIdx(idx);
    setStoryIdx(0);
    setProgress(0);
  }

  if (!group || !story) {
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1a1a2e]">
      {/* Close */}
      <button onClick={onClose} className="absolute top-4 right-4 z-10 rounded-full p-2 text-white/70 hover:text-white hover:bg-white/10 transition">
        <X className="h-6 w-6" />
      </button>

      {/* Main layout: prev previews | main story | next previews */}
      <div className="flex items-center gap-4 h-[90vh] max-h-[820px] w-full max-w-[1100px] px-4">

        {/* Left preview cards */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {prevGroups.map((pg) => {
            const pgIdx = localGroups.findIndex((g) => g.user.id === pg.user.id);
            const previewStory = pg.stories[0];
            return (
              <button
                key={pg.user.id}
                onClick={() => jumpToGroup(pgIdx)}
                className="relative w-[120px] h-[200px] rounded-xl overflow-hidden bg-gray-800 shrink-0 opacity-60 hover:opacity-90 transition-opacity group"
              >
                {previewStory.mediaType === 'video' ? (
                  <video src={previewStory.mediaUrl} className="w-full h-full object-cover" muted playsInline />
                ) : (
                  <img src={previewStory.mediaUrl} alt="" className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-black/30" />
                <div className="absolute bottom-2 left-0 right-0 flex flex-col items-center gap-1">
                  <div className={`rounded-full p-[2px] ${pg.hasUnviewed ? 'bg-gradient-to-tr from-fuchsia-500 via-rose-500 to-amber-400' : 'bg-gray-400'}`}>
                    <div className="rounded-full bg-[#1a1a2e] p-[1.5px]">
                      <Avatar src={pg.user.avatarUrl} alt={pg.user.displayName} size={32} />
                    </div>
                  </div>
                  <span className="text-[10px] text-white font-medium truncate max-w-[100px]">{pg.user.username}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Prev arrow */}
        {(groupIdx > 0 || storyIdx > 0) && (
          <button onClick={goPrev} className="shrink-0 rounded-full bg-white/10 p-2 text-white/70 hover:text-white hover:bg-white/20 transition hidden md:flex">
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Main story card */}
        <div className="relative flex-1 max-w-[420px] h-full rounded-2xl overflow-hidden bg-black mx-auto flex flex-col shadow-2xl">
          {/* Progress bars */}
          <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 px-3 pt-2">
            {group.stories.map((s, i) => (
              <div key={s.id} className="flex-1 h-[3px] rounded-full bg-white/30 overflow-hidden">
                <div
                  className="h-full bg-white rounded-full"
                  style={{
                    width: `${i < storyIdx ? 100 : i === storyIdx ? progress * 100 : 0}%`,
                    transition: i === storyIdx ? 'none' : undefined,
                  }}
                />
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

          {/* Tap zones for prev/next on mobile */}
          <div className="absolute inset-0 z-10 flex">
            <div className="w-1/3 h-full" onClick={goPrev} />
            <div className="w-1/3 h-full" onClick={() => setPaused((p) => !p)} />
            <div className="w-1/3 h-full" onClick={goNext} />
          </div>

          {/* Media */}
          <div className="flex-1 flex items-center justify-center bg-black">
            {story.mediaType === 'video' ? (
              <video
                ref={videoRef}
                src={story.mediaUrl}
                className="w-full h-full object-contain"
                playsInline
                muted={false}
              />
            ) : (
              <img
                src={story.mediaUrl}
                alt=""
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* Bottom bar: like + reply OR viewers */}
          <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/70 to-transparent pt-10 pb-4 px-4">
            {isMe ? (
              <div>
                {/* Viewers toggle */}
                <button
                  onClick={() => { setShowViewers((v) => !v); setPaused(true); }}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-white/15 backdrop-blur px-4 py-2.5 text-white transition hover:bg-white/25"
                >
                  <Eye className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {loadingViewers ? '...' : `${viewers.length} vista${viewers.length !== 1 ? 's' : ''}`}
                  </span>
                  {showViewers ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                </button>

                {/* Viewers list */}
                {showViewers && (
                  <div className="mt-2 max-h-[180px] overflow-y-auto rounded-xl bg-black/60 backdrop-blur-md border border-white/10">
                    {viewers.length === 0 ? (
                      <div className="py-4 text-center text-xs text-white/50">Nadie ha visto esta historia aún</div>
                    ) : (
                      viewers.map((v) => (
                        <Link
                          key={v.id}
                          href={`/profile/${v.username}`}
                          onClick={onClose}
                          className="flex items-center gap-3 px-3 py-2 transition hover:bg-white/10"
                        >
                          <Avatar src={v.avatarUrl} alt={v.displayName} size={32} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{v.displayName}</p>
                            <p className="text-[11px] text-white/50">@{v.username}</p>
                          </div>
                          <span className="text-[10px] text-white/40 shrink-0">{timeAgo(v.viewedAt)}</span>
                        </Link>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
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
                  <button
                    type="submit"
                    disabled={!reply.trim() || sending}
                    className="rounded-full bg-primary-600 p-2 text-white disabled:opacity-40 transition hover:bg-primary-700"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
                <button
                  onClick={toggleLike}
                  className="shrink-0 transition-transform active:scale-125"
                >
                  <Heart
                    className={`h-7 w-7 transition ${story.likedByMe ? 'fill-red-500 text-red-500' : 'text-white'}`}
                  />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Next arrow */}
        {(storyIdx < group.stories.length - 1 || groupIdx < localGroups.length - 1) && (
          <button onClick={goNext} className="shrink-0 rounded-full bg-white/10 p-2 text-white/70 hover:text-white hover:bg-white/20 transition hidden md:flex">
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Right preview cards */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {nextGroups.map((ng) => {
            const ngIdx = localGroups.findIndex((g) => g.user.id === ng.user.id);
            const previewStory = ng.stories[0];
            return (
              <button
                key={ng.user.id}
                onClick={() => jumpToGroup(ngIdx)}
                className="relative w-[120px] h-[200px] rounded-xl overflow-hidden bg-gray-800 shrink-0 opacity-60 hover:opacity-90 transition-opacity group"
              >
                {previewStory.mediaType === 'video' ? (
                  <video src={previewStory.mediaUrl} className="w-full h-full object-cover" muted playsInline />
                ) : (
                  <img src={previewStory.mediaUrl} alt="" className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-black/30" />
                <div className="absolute bottom-2 left-0 right-0 flex flex-col items-center gap-1">
                  <div className={`rounded-full p-[2px] ${ng.hasUnviewed ? 'bg-gradient-to-tr from-fuchsia-500 via-rose-500 to-amber-400' : 'bg-gray-400'}`}>
                    <div className="rounded-full bg-[#1a1a2e] p-[1.5px]">
                      <Avatar src={ng.user.avatarUrl} alt={ng.user.displayName} size={32} />
                    </div>
                  </div>
                  <span className="text-[10px] text-white font-medium truncate max-w-[100px]">{ng.user.username}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
