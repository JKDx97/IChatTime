'use client';

import { useEffect, useState, useRef, useCallback, FormEvent } from 'react';
import Image from 'next/image';
import {
  X, Send, Loader2, ImagePlus, Play,
  CornerDownRight, ChevronDown, ChevronUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { FlashComment } from '@/lib/types';
import Avatar from './Avatar';
import { timeAgo } from '@/lib/timeago';

function mediaUrl(u: string) {
  return u.startsWith('http') ? u : `/uploads/${u}`;
}
function isVideoUrl(u: string) {
  return /\.(mp4|webm|mov)$/i.test(u);
}

/* ─── Recursive Flash Comment Item ─────────── */
function FlashCommentItem({
  comment,
  depth,
  me,
  flashOwnerId,
  parentCommentUserId,
  onDelete,
  onReply,
}: {
  comment: FlashComment;
  depth: number;
  me: { id: string } | null;
  flashOwnerId: string;
  parentCommentUserId?: string;
  onDelete: (id: string) => void;
  onReply: (parentId: string, username: string) => void;
}) {
  const [replies, setReplies] = useState<FlashComment[]>([]);
  const [showReplies, setShowReplies] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [localRepliesCount, setLocalRepliesCount] = useState(comment.repliesCount);

  const fetchReplies = useCallback(async () => {
    setLoadingReplies(true);
    try {
      const { data } = await api.get(`/flashes/comments/${comment.id}/replies?limit=50`);
      setReplies(data.items ?? data);
    } catch { /* ignore */ }
    setLoadingReplies(false);
  }, [comment.id]);

  const toggleReplies = () => {
    if (!showReplies && replies.length === 0) fetchReplies();
    setShowReplies((p) => !p);
  };

  useEffect(() => {
    const handler = (e: CustomEvent<FlashComment>) => {
      if (e.detail.parentId === comment.id) {
        setReplies((prev) => [...prev, e.detail]);
        setLocalRepliesCount((c) => c + 1);
        setShowReplies(true);
      }
    };
    window.addEventListener('flash-new-reply' as any, handler as any);
    return () => window.removeEventListener('flash-new-reply' as any, handler as any);
  }, [comment.id]);

  const hasMedia = comment.mediaUrls && comment.mediaUrls.length > 0;
  const ml = depth > 0 ? 'ml-7' : '';

  return (
    <div className={ml}>
      <div className="flex gap-2 py-1 group">
        <div className="shrink-0 pt-0.5">
          <Avatar src={comment.user?.avatarUrl} alt={comment.user?.displayName} size={depth > 0 ? 24 : 28} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-bold truncate">{comment.user?.username}</span>
            <span className="text-[10px] text-gray-400 flex-shrink-0">{timeAgo(comment.createdAt)}</span>
          </div>
          {comment.content && <p className="text-sm text-gray-800 break-words">{comment.content}</p>}
          {hasMedia && (
            <div className="mt-1 flex gap-1 flex-wrap">
              {comment.mediaUrls.map((u, i) => {
                const src = mediaUrl(u);
                return isVideoUrl(u) ? (
                  <video key={i} src={src} controls className="max-h-32 rounded-lg" />
                ) : (
                  <div key={i} className="relative h-24 w-24 rounded-lg overflow-hidden bg-gray-100">
                    <Image src={src} alt="" fill className="object-cover" sizes="96px" />
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-3 mt-0.5">
            <button
              onClick={() => onReply(comment.id, comment.user?.username)}
              className="text-[10px] font-semibold text-gray-400 hover:text-gray-600 transition"
            >
              Responder
            </button>
            {me && (me.id === comment.userId || me.id === flashOwnerId || (parentCommentUserId && me.id === parentCommentUserId)) && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition"
              >
                Eliminar
              </button>
            )}
          </div>
          {localRepliesCount > 0 && (
            <button onClick={toggleReplies} className="flex items-center gap-1 mt-0.5 text-[10px] font-semibold text-primary-500 hover:text-primary-700 transition">
              {showReplies ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showReplies ? 'Ocultar' : `${localRepliesCount} respuesta${localRepliesCount > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
      {showReplies && (
        loadingReplies ? (
          <div className="ml-10 py-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
          </div>
        ) : (
          replies.map((r) => (
            <FlashCommentItem
              key={r.id}
              comment={r}
              depth={depth + 1}
              me={me}
              flashOwnerId={flashOwnerId}
              parentCommentUserId={comment.userId}
              onDelete={onDelete}
              onReply={onReply}
            />
          ))
        )
      )}
    </div>
  );
}

interface Props {
  flashId: string;
  flashOwnerId?: string;
  open: boolean;
  onClose: () => void;
  onCountChange?: (delta: number) => void;
}

export default function FlashCommentsModal({ flashId, flashOwnerId, open, onClose, onCountChange }: Props) {
  const me = useAuthStore((s) => s.user);
  const [comments, setComments] = useState<FlashComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [mediaPreviews, setMediaPreviews] = useState<{ file: File; url: string }[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get(`/flashes/${flashId}/comments?limit=50`)
      .then((r) => setComments(r.data.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
    setTimeout(() => inputRef.current?.focus(), 200);
  }, [open, flashId]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [comments]);

  function handleReply(parentId: string, username: string) {
    setReplyTo({ id: parentId, username });
    setText(`@${username} `);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function cancelReply() {
    setReplyTo(null);
    setText('');
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const previews = files.slice(0, 5).map((f) => ({ file: f, url: URL.createObjectURL(f) }));
    setMediaPreviews((prev) => [...prev, ...previews].slice(0, 5));
    e.target.value = '';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const hasText = text.trim().length > 0;
    const hasMedia = mediaPreviews.length > 0;
    if ((!hasText && !hasMedia) || sending) return;
    setSending(true);

    try {
      let uploadedUrls: string[] = [];
      if (hasMedia) {
        setUploadingMedia(true);
        const fd = new FormData();
        mediaPreviews.forEach((p) => fd.append('media', p.file));
        const { data: upRes } = await api.post('/flashes/comments/upload', fd);
        uploadedUrls = upRes.urls;
        setUploadingMedia(false);
      }

      const payload: Record<string, unknown> = {};
      if (hasText) payload.content = text.trim();
      if (replyTo) payload.parentId = replyTo.id;
      if (uploadedUrls.length > 0) payload.mediaUrls = uploadedUrls;

      const { data } = await api.post(`/flashes/${flashId}/comments`, payload);

      if (replyTo) {
        window.dispatchEvent(new CustomEvent('flash-new-reply', { detail: data }));
      } else {
        setComments((prev) => [...prev, data]);
      }

      setText('');
      setReplyTo(null);
      setMediaPreviews([]);
      onCountChange?.(1);
    } catch {
      toast.error('No se pudo comentar');
    } finally {
      setSending(false);
      setUploadingMedia(false);
    }
  }

  async function deleteComment(commentId: string) {
    try {
      await api.delete(`/flashes/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      onCountChange?.(-1);
    } catch {
      toast.error('No se pudo eliminar');
    }
  }

  if (!open) return null;

  return (
    <div
      className="w-[340px] shrink-0 bg-white border-l border-gray-200 flex flex-col"
      style={{ animation: 'slide-in-right 0.2s ease-out both' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 shrink-0">
        <h3 className="text-sm font-bold text-gray-900">Comentarios</h3>
        <button onClick={onClose} className="rounded-full p-1 hover:bg-gray-100 transition">
          <X className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      {/* Comments list */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">Sé el primero en comentar</p>
        ) : (
          comments.map((c) => (
            <FlashCommentItem
              key={c.id}
              comment={c}
              depth={0}
              me={me}
              flashOwnerId={flashOwnerId ?? ''}
              onDelete={deleteComment}
              onReply={handleReply}
            />
          ))
        )}
      </div>

      {/* Reply indicator + media previews */}
      {(replyTo || mediaPreviews.length > 0) && (
        <div className="border-t border-gray-100 px-3 py-1.5 shrink-0">
          {replyTo && (
            <div className="flex items-center gap-2 text-[11px] text-gray-500">
              <CornerDownRight className="h-3 w-3" />
              <span>Respondiendo a <b>@{replyTo.username}</b></span>
              <button onClick={cancelReply} className="ml-auto text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>
            </div>
          )}
          {mediaPreviews.length > 0 && (
            <div className="flex gap-1 mt-1 overflow-x-auto">
              {mediaPreviews.map((p, i) => (
                <div key={i} className="relative h-12 w-12 shrink-0 rounded-md overflow-hidden bg-gray-100">
                  {p.file.type.startsWith('video/') ? (
                    <div className="flex h-full w-full items-center justify-center bg-gray-900/80"><Play className="h-3 w-3 text-white" /></div>
                  ) : (
                    <Image src={p.url} alt="" fill className="object-cover" sizes="48px" />
                  )}
                  <button
                    onClick={() => { URL.revokeObjectURL(p.url); setMediaPreviews((prev) => prev.filter((_, j) => j !== i)); }}
                    className="absolute right-0 top-0 rounded-full bg-black/60 p-0.5 text-white"
                  >
                    <X className="h-2 w-2" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-gray-100 px-3 py-2.5 flex items-center gap-2 shrink-0">
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" multiple onChange={handleFileSelect} />
        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-gray-600 transition shrink-0">
          <ImagePlus className="h-4 w-4" />
        </button>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={replyTo ? `Responder a @${replyTo.username}…` : 'Escribe un comentario...'}
          maxLength={2000}
          className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm outline-none focus:border-primary-400 focus:bg-white transition"
        />
        <button
          type="submit"
          disabled={(!text.trim() && mediaPreviews.length === 0) || sending}
          className="rounded-full bg-primary-600 p-2 text-white transition hover:bg-primary-700 disabled:opacity-40"
        >
          {sending || uploadingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
