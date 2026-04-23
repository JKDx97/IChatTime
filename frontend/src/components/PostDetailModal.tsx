'use client';

import { useEffect, useState, FormEvent, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, Heart, MessageCircle, Bookmark,
  Send, Trash2, X, ImagePlus, Loader2, Play,
  CornerDownRight, ChevronDown, ChevronUp,
} from 'lucide-react';
import { timeAgo, formatExactDate } from '@/lib/timeago';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { Post, Comment } from '@/lib/types';
import Avatar from './Avatar';
import { renderHashtags } from '@/lib/renderHashtags';

function mediaUrl(u: string) {
  return u.startsWith('http') ? u : `/uploads/${u}`;
}
function isVideo(u: string) {
  return /\.(mp4|webm|mov)$/i.test(u);
}

interface Props {
  post: Post;
  open: boolean;
  onClose: () => void;
  onPostUpdate?: (post: Post) => void;
  onDelete?: (id: string) => void;
}

/* ─── Comment Item (recursive) ──────────────── */
function CommentItem({
  comment,
  postId,
  depth,
  me,
  postOwnerId,
  parentCommentUserId,
  onDelete,
  onReply,
}: {
  comment: Comment;
  postId: string;
  depth: number;
  me: { id: string } | null;
  postOwnerId: string;
  parentCommentUserId?: string;
  onDelete: (id: string, parentId: string | null) => void;
  onReply: (parentId: string, username: string) => void;
}) {
  const [replies, setReplies] = useState<Comment[]>([]);
  const [showReplies, setShowReplies] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [localRepliesCount, setLocalRepliesCount] = useState(comment.repliesCount);

  const fetchReplies = useCallback(async () => {
    setLoadingReplies(true);
    try {
      const { data } = await api.get(`/comments/${comment.id}/replies?limit=50`);
      setReplies(data.items ?? data);
    } catch { /* ignore */ }
    setLoadingReplies(false);
  }, [comment.id]);

  const toggleReplies = () => {
    if (!showReplies && replies.length === 0) fetchReplies();
    setShowReplies((p) => !p);
  };

  // Expose a way for parent to push a new reply
  useEffect(() => {
    const handler = (e: CustomEvent<Comment>) => {
      if (e.detail.parentId === comment.id) {
        setReplies((prev) => [...prev, e.detail]);
        setLocalRepliesCount((c) => c + 1);
        setShowReplies(true);
      }
    };
    window.addEventListener('new-reply' as any, handler as any);
    return () => window.removeEventListener('new-reply' as any, handler as any);
  }, [comment.id]);

  const hasMedia = comment.mediaUrls && comment.mediaUrls.length > 0;
  const ml = depth > 0 ? 'ml-8' : '';

  return (
    <div className={ml}>
      <div className="flex gap-2.5 px-4 py-1.5 group">
        <div className="shrink-0 pt-0.5">
          <Avatar src={comment.user?.avatarUrl} alt={comment.user?.displayName} size={depth > 0 ? 24 : 28} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] leading-[18px]">
            <span className="font-semibold">{comment.user?.username}</span>{' '}
            {comment.content && <span className="text-gray-700">{comment.content}</span>}
          </p>
          {/* Media */}
          {hasMedia && (
            <div className="mt-1 flex gap-1 flex-wrap">
              {comment.mediaUrls.map((u, i) => {
                const src = mediaUrl(u);
                return isVideo(u) ? (
                  <video key={i} src={src} controls className="max-h-40 rounded-lg" />
                ) : (
                  <div key={i} className="relative h-32 w-32 rounded-lg overflow-hidden bg-gray-100">
                    <Image src={src} alt="" fill className="object-cover" sizes="128px" />
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[11px] text-gray-400" title={formatExactDate(comment.createdAt)}>
              {timeAgo(comment.createdAt)}
            </span>
            <button
              onClick={() => onReply(comment.id, comment.user?.username)}
              className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 transition"
            >
              Responder
            </button>
            {me && (me.id === comment.userId || me.id === postOwnerId || (parentCommentUserId && me.id === parentCommentUserId)) && (
              <button
                onClick={() => onDelete(comment.id, comment.parentId)}
                className="text-[11px] text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition"
              >
                Eliminar
              </button>
            )}
          </div>
          {/* Toggle replies */}
          {localRepliesCount > 0 && (
            <button onClick={toggleReplies} className="flex items-center gap-1 mt-1 text-[11px] font-semibold text-primary-500 hover:text-primary-700 transition">
              {showReplies ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showReplies ? 'Ocultar respuestas' : `Ver ${localRepliesCount} respuesta${localRepliesCount > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
      {/* Nested replies */}
      {showReplies && (
        loadingReplies ? (
          <div className="ml-12 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          </div>
        ) : (
          replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              postId={postId}
              depth={depth + 1}
              me={me}
              postOwnerId={postOwnerId}
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

export default function PostDetailModal({ post, open, onClose, onPostUpdate, onDelete }: Props) {
  const me = useAuthStore((s) => s.user);
  const [liked, setLiked] = useState(post.likedByMe);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [saved, setSaved] = useState(post.savedByMe ?? false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [mediaPreviews, setMediaPreviews] = useState<{ file: File; url: string }[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLiked(post.likedByMe);
    setLikesCount(post.likesCount);
    setCommentsCount(post.commentsCount);
  }, [post]);

  useEffect(() => {
    if (!open) return;
    setLoadingComments(true);
    api.get(`/posts/${post.id}/comments`)
      .then((r) => setComments(r.data.items ?? r.data))
      .catch(() => {})
      .finally(() => setLoadingComments(false));
  }, [open, post.id]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  async function toggleLike() {
    if (busy) return;
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
      onPostUpdate?.({ ...post, likedByMe: !liked, likesCount: liked ? likesCount - 1 : likesCount + 1 });
    } catch { toast.error('Acción fallida'); }
  }

  async function toggleSave() {
    if (busy) return;
    try {
      if (saved) {
        await api.delete(`/posts/${post.id}/save`);
        setSaved(false);
      } else {
        await api.post(`/posts/${post.id}/save`);
        setSaved(true);
      }
      onPostUpdate?.({ ...post, savedByMe: !saved });
    } catch { toast.error('Acción fallida'); }
  }

  function handleReply(parentId: string, username: string) {
    setReplyTo({ id: parentId, username });
    setBody(`@${username} `);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function cancelReply() {
    setReplyTo(null);
    setBody('');
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const previews = files.slice(0, 5).map((f) => ({ file: f, url: URL.createObjectURL(f) }));
    setMediaPreviews((prev) => [...prev, ...previews].slice(0, 5));
    e.target.value = '';
  }

  async function handleComment(e: FormEvent) {
    e.preventDefault();
    const hasText = body.trim().length > 0;
    const hasMedia = mediaPreviews.length > 0;
    if (!hasText && !hasMedia) return;
    setBusy(true);

    try {
      let uploadedUrls: string[] = [];
      if (hasMedia) {
        setUploadingMedia(true);
        const fd = new FormData();
        mediaPreviews.forEach((p) => fd.append('media', p.file));
        const { data: upRes } = await api.post('/comments/upload', fd);
        uploadedUrls = upRes.urls;
        setUploadingMedia(false);
      }

      const payload: Record<string, unknown> = {};
      if (hasText) payload.content = body.trim();
      if (replyTo) payload.parentId = replyTo.id;
      if (uploadedUrls.length > 0) payload.mediaUrls = uploadedUrls;

      const { data } = await api.post(`/posts/${post.id}/comments`, payload);

      if (replyTo) {
        // Dispatch custom event so CommentItem can pick it up
        window.dispatchEvent(new CustomEvent('new-reply', { detail: data }));
      } else {
        setComments((prev) => [...prev, data]);
      }

      setCommentsCount((c) => c + 1);
      setBody('');
      setReplyTo(null);
      setMediaPreviews([]);
      onPostUpdate?.({ ...post, commentsCount: commentsCount + 1 });
      if (!replyTo) setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
      toast.error('No se pudo agregar el comentario');
    } finally {
      setBusy(false);
      setUploadingMedia(false);
    }
  }

  async function deleteComment(commentId: string, parentId: string | null) {
    try {
      await api.delete(`/comments/${commentId}`);
      if (parentId) {
        // It's a reply – remove from nested via custom event would be complex, just reload
        // For simplicity we remove from top-level if found
      }
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentsCount((c) => c - 1);
      onPostUpdate?.({ ...post, commentsCount: commentsCount - 1 });
    } catch { toast.error('No se pudo eliminar el comentario'); }
  }

  async function handleDeletePost() {
    if (!confirm('¿Eliminar esta publicación?')) return;
    try {
      await api.delete(`/posts/${post.id}`);
      onDelete?.(post.id);
      onClose();
      toast.success('Publicación eliminada');
    } catch { toast.error('No se pudo eliminar'); }
  }

  if (!open) return null;

  const postMediaUrls = post.mediaUrls ?? [];
  const totalMedia = postMediaUrls.length;

  const modal = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0" onClick={onClose}></div>

      <div
        className="relative z-10 flex bg-white rounded-xl shadow-2xl ring-1 ring-black/10 animate-modal-enter overflow-hidden"
        style={{ width: 'calc(100vw - 200px)', maxWidth: 1000, height: 'calc(100vh - 120px)', maxHeight: 720 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-20 rounded-full bg-white/80 p-1.5 text-gray-500 shadow-sm border border-gray-200 transition hover:bg-gray-100 hover:text-gray-800"
        >
          <X className="h-4 w-4" />
        </button>

        {/* ── LEFT: Media Carousel ── */}
        <div className="hidden md:flex flex-[1.2] bg-black items-center justify-center overflow-hidden rounded-l-xl relative select-none">
          {totalMedia > 0 ? (() => {
            const currentUrl = postMediaUrls[mediaIndex];
            const src = currentUrl.startsWith('http') ? currentUrl : `/uploads/${currentUrl}`;
            const isVid = currentUrl.match(/\.(mp4|webm|mov)$/i);
            return (
              <>
                {isVid ? (
                  <video src={src} controls className="h-full w-full object-contain" />
                ) : (
                  <div className="relative w-full h-full">
                    <Image src={src} alt="Publicación" fill className="object-contain" sizes="(max-width:768px) 100vw, 50vw" />
                  </div>
                )}
                {totalMedia > 1 && (
                  <>
                    {mediaIndex > 0 && (
                      <button onClick={() => setMediaIndex((i) => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 text-gray-800 shadow transition hover:bg-white active:scale-90">
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                    )}
                    {mediaIndex < totalMedia - 1 && (
                      <button onClick={() => setMediaIndex((i) => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-1.5 text-gray-800 shadow transition hover:bg-white active:scale-90">
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    )}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {postMediaUrls.map((_, i) => (
                        <button key={i} onClick={() => setMediaIndex(i)} className={`h-1.5 rounded-full transition-all ${i === mediaIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
                      ))}
                    </div>
                  </>
                )}
              </>
            );
          })() : (
            <div className="flex items-center justify-center w-full h-full bg-gray-100 text-gray-400 text-sm">Sin imagen</div>
          )}
        </div>

        {/* ── RIGHT: Details ── */}
        <div className="flex flex-col flex-1 min-w-0 border-l border-gray-200">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 shrink-0">
            <Link href={`/profile/${post.user.username}`} onClick={onClose}>
              <Avatar src={post.user.avatarUrl} alt={post.user.displayName} size={32} />
            </Link>
            <Link href={`/profile/${post.user.username}`} onClick={onClose} className="text-sm font-semibold text-gray-900 hover:underline truncate">
              {post.user.username}
            </Link>
            <div className="flex-1"></div>
            {me?.id === post.user.id && (
              <button onClick={handleDeletePost} className="rounded p-1.5 text-gray-400 hover:text-red-500 transition">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {post.content && (
              <div className="flex gap-3 px-4 pt-4 pb-2">
                <div className="shrink-0">
                  <Avatar src={post.user.avatarUrl} alt={post.user.displayName} size={28} />
                </div>
                <div>
                  <p className="text-[13px] leading-[18px]">
                    <Link href={`/profile/${post.user.username}`} onClick={onClose} className="font-semibold hover:underline">{post.user.username}</Link>{' '}
                    <span className="text-gray-700">{renderHashtags(post.content)}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-gray-400" title={formatExactDate(post.createdAt)}>{timeAgo(post.createdAt)}</p>
                </div>
              </div>
            )}

            {/* Comments */}
            {loadingComments ? (
              <div className="flex justify-center py-10">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-transparent"></div>
              </div>
            ) : comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 py-16 px-6 text-center">
                <p className="text-lg font-bold text-gray-900">Aún no hay comentarios.</p>
                <p className="mt-1 text-sm text-gray-400">Inicia la conversación.</p>
              </div>
            ) : (
              <div className="py-1">
                {comments.map((c) => (
                  <CommentItem
                    key={c.id}
                    comment={c}
                    postId={post.id}
                    depth={0}
                    me={me}
                    postOwnerId={post.user.id}
                    onDelete={deleteComment}
                    onReply={handleReply}
                  />
                ))}
                <div ref={commentsEndRef} />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="border-t border-gray-200 px-4 pt-2 pb-2 shrink-0">
            <div className="flex items-center gap-4">
              <button onClick={toggleLike} className="transition active:scale-90">
                <Heart className={`h-6 w-6 ${liked ? 'fill-red-500 text-red-500' : 'text-gray-900 hover:text-gray-500'}`} />
              </button>
              <button onClick={() => inputRef.current?.focus()} className="transition active:scale-90">
                <MessageCircle className="h-6 w-6 text-gray-900 hover:text-gray-500" />
              </button>
              <div className="flex-1" />
              <button onClick={toggleSave} className="transition active:scale-90">
                <Bookmark className={`h-6 w-6 ${saved ? 'fill-gray-900 text-gray-900' : 'text-gray-900 hover:text-gray-500'}`} />
              </button>
            </div>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {likesCount === 0 ? 'Sé el primero en indicar que te gusta esto' : `${likesCount.toLocaleString()} me gusta`}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-400" title={formatExactDate(post.createdAt)}>
              {timeAgo(post.createdAt)}
            </p>
          </div>

          {/* Reply indicator + media previews */}
          {(replyTo || mediaPreviews.length > 0) && (
            <div className="border-t border-gray-100 px-4 py-1.5 shrink-0">
              {replyTo && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <CornerDownRight className="h-3 w-3" />
                  <span>Respondiendo a <b>@{replyTo.username}</b></span>
                  <button onClick={cancelReply} className="ml-auto text-gray-400 hover:text-gray-600"><X className="h-3 w-3" /></button>
                </div>
              )}
              {mediaPreviews.length > 0 && (
                <div className="flex gap-1.5 mt-1 overflow-x-auto">
                  {mediaPreviews.map((p, i) => (
                    <div key={i} className="relative h-14 w-14 shrink-0 rounded-md overflow-hidden bg-gray-100">
                      {p.file.type.startsWith('video/') ? (
                        <div className="flex h-full w-full items-center justify-center bg-gray-900/80"><Play className="h-4 w-4 text-white" /></div>
                      ) : (
                        <Image src={p.url} alt="" fill className="object-cover" sizes="56px" />
                      )}
                      <button
                        onClick={() => { URL.revokeObjectURL(p.url); setMediaPreviews((prev) => prev.filter((_, j) => j !== i)); }}
                        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Comment input */}
          <form onSubmit={handleComment} className="flex items-center gap-2 border-t border-gray-200 px-4 py-3 shrink-0">
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" multiple onChange={handleFileSelect} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-gray-600 transition shrink-0">
              <ImagePlus className="h-5 w-5" />
            </button>
            <input
              ref={inputRef}
              type="text"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={replyTo ? `Responder a @${replyTo.username}…` : 'Agrega un comentario…'}
              className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
            />
            <button
              type="submit"
              disabled={busy || (!body.trim() && mediaPreviews.length === 0)}
              className="text-sm font-bold text-primary-500 hover:text-primary-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              {uploadingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publicar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
