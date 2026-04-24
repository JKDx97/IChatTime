'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft,
  Send,
  ImagePlus,
  X,
  Loader2,
  Film,
  Play,
  Mic,
  Square,
  Trash2,
  Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { Message, User } from '@/lib/types';
import Avatar from '@/components/Avatar';
import { timeAgo } from '@/lib/timeago';
import {
  connectChatSocket,
  getChatSocket,
} from '@/lib/chatSocket';
import MediaLightbox from '@/components/MediaLightbox';
import MessageStatus, { getMessageStatus } from '@/components/MessageStatus';
import TypingBubble from '@/components/TypingBubble';
import VoiceNotePlayer from '@/components/VoiceNotePlayer';
import LiveWaveform from '@/components/LiveWaveform';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { getSocket } from '@/lib/socket';
import LoadingLogo from '@/components/LoadingLogo';

const MAX_FILES = 10;
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB per file

interface MediaPreview {
  file: File;
  url: string;
  type: 'image' | 'video';
}

export default function ChatPage() {
  const { userId: partnerId } = useParams<{ userId: string }>();
  const me = useAuthStore((s) => s.user);
  const router = useRouter();

  const [partner, setPartner] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [text, setText] = useState('');
  const [mediaPreviews, setMediaPreviews] = useState<MediaPreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sending, setSending] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerLastSeen, setPartnerLastSeen] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAtBottomRef = useRef(true);
  const recorder = useAudioRecorder();

  // Load partner info
  useEffect(() => {
    if (!partnerId) return;
    // Try fetching by ID first, then fallback to username
    api
      .get(`/users/id/${partnerId}`)
      .then((r) => setPartner(r.data))
      .catch(() => {
        // If not found by ID, might be username
        api.get(`/users/${partnerId}`).then((r) => setPartner(r.data)).catch(() => {
          toast.error('Usuario no encontrado');
          router.push('/messages');
        });
      });
  }, [partnerId, router]);

  // Load message history
  const fetchMessages = useCallback(
    async (c: string | null, reset: boolean) => {
      try {
        const params = new URLSearchParams({ limit: '40' });
        if (c) params.set('cursor', c);
        const { data } = await api.get(
          `/messages/conversation/${partnerId}?${params}`,
        );
        const items: Message[] = data.items ?? [];
        if (!data.nextCursor) setHasMore(false);
        setCursor(data.nextCursor ?? null);
        setMessages((prev) => (reset ? items : [...items, ...prev]));
      } catch {
        /* ignore */
      }
      setLoadingHistory(false);
    },
    [partnerId],
  );

  useEffect(() => {
    fetchMessages(null, true);
  }, [fetchMessages]);

  // Mark as read
  useEffect(() => {
    if (!partnerId) return;
    api.patch(`/messages/${partnerId}/read`).catch(() => {});
  }, [partnerId, messages.length]);

  // Scroll to bottom on new messages (if already at bottom)
  useEffect(() => {
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Track scroll position
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    isAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 60;

    // Load more when scrolled to top
    if (el.scrollTop < 50 && hasMore && !loadingHistory) {
      setLoadingHistory(true);
      fetchMessages(cursor, false);
    }
  };

  // WebSocket: real-time messages
  useEffect(() => {
    if (!me || !partnerId) return;
    connectChatSocket();
    const s = getChatSocket();

    const onNewMessage = (msg: Message) => {
      if (msg.senderId === partnerId || msg.receiverId === partnerId) {
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === msg.id)) return prev;
          // Replace temp message if exists
          if (msg.tempId) {
            const idx = prev.findIndex(
              (m) => (m as any).tempId === msg.tempId && !(m as any).id,
            );
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = msg;
              return copy;
            }
          }
          return [...prev, msg];
        });
        // Mark as read immediately if sender is partner
        if (msg.senderId === partnerId) {
          s.emit('mark_read', { partnerId });
        }
      }
    };

    const onTyping = (data: { userId: string }) => {
      if (data.userId === partnerId) {
        setPartnerTyping(true);
        // Auto-clear after 3s
        setTimeout(() => setPartnerTyping(false), 3000);
      }
    };

    const onStopTyping = (data: { userId: string }) => {
      if (data.userId === partnerId) setPartnerTyping(false);
    };

    const onDelivered = (d: { messageId: string; tempId?: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          (m.id === d.messageId || (d.tempId && m.tempId === d.tempId))
            ? { ...m, _delivered: true }
            : m,
        ),
      );
    };

    const onMessagesRead = (d: { readBy: string; readAt: string }) => {
      if (d.readBy === partnerId) {
        setMessages((prev) =>
          prev.map((m) =>
            m.senderId === me.id && !m.readAt
              ? { ...m, readAt: d.readAt }
              : m,
          ),
        );
      }
    };

    const onDeletedForAll = (d: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === d.messageId
            ? { ...m, deletedForAll: true, content: null, mediaUrls: [] }
            : m,
        ),
      );
    };

    s.on('new_message', onNewMessage);
    s.on('message_sent', onNewMessage);
    s.on('user_typing', onTyping);
    s.on('user_stop_typing', onStopTyping);
    s.on('message_delivered', onDelivered);
    s.on('messages_read', onMessagesRead);
    s.on('message_deleted_for_all', onDeletedForAll);

    return () => {
      s.off('new_message', onNewMessage);
      s.off('message_sent', onNewMessage);
      s.off('user_typing', onTyping);
      s.off('user_stop_typing', onStopTyping);
      s.off('message_delivered', onDelivered);
      s.off('messages_read', onMessagesRead);
      s.off('message_deleted_for_all', onDeletedForAll);
    };
  }, [me, partnerId]);

  // Track partner online/offline via realtime socket
  useEffect(() => {
    if (!partnerId) return;
    const rs = getSocket();
    const onOnline = (d: { userId: string }) => {
      if (d.userId === partnerId) setPartnerOnline(true);
    };
    const onOffline = (d: { userId: string; lastSeen?: string }) => {
      if (d.userId === partnerId) {
        setPartnerOnline(false);
        if (d.lastSeen) setPartnerLastSeen(d.lastSeen);
      }
    };
    rs.on('user_online', onOnline);
    rs.on('user_offline', onOffline);
    return () => {
      rs.off('user_online', onOnline);
      rs.off('user_offline', onOffline);
    };
  }, [partnerId]);

  // Typing indicator emission
  const emitTyping = () => {
    const s = getChatSocket();
    s.emit('typing', { receiverId: partnerId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      s.emit('stop_typing', { receiverId: partnerId });
    }, 2000);
  };

  // File selection handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const total = mediaPreviews.length + files.length;
    if (total > MAX_FILES) {
      toast.error(`Máximo ${MAX_FILES} archivos`);
      return;
    }

    const newPreviews: MediaPreview[] = [];
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name} excede 50 MB`);
        continue;
      }
      const isVideo = file.type.startsWith('video/');
      newPreviews.push({
        file,
        url: URL.createObjectURL(file),
        type: isVideo ? 'video' : 'image',
      });
    }
    setMediaPreviews((prev) => [...prev, ...newPreviews]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePreview = (index: number) => {
    setMediaPreviews((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Send message
  const handleSend = async () => {
    const hasText = text.trim().length > 0;
    const hasMedia = mediaPreviews.length > 0;
    if (!hasText && !hasMedia) return;
    if (sending || uploading) return;

    let mediaUrls: string[] = [];

    // Upload media if any
    if (hasMedia) {
      setUploading(true);
      setUploadProgress(0);
      try {
        const fd = new FormData();
        mediaPreviews.forEach((p) => fd.append('media', p.file));
        const { data } = await api.post('/messages/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (e.total) {
              setUploadProgress(Math.round((e.loaded * 100) / e.total));
            }
          },
        });
        mediaUrls = data.urls;
      } catch {
        toast.error('Error al subir archivos');
        setUploading(false);
        setUploadProgress(0);
        return;
      }
      setUploading(false);
      setUploadProgress(0);
    }

    // Send via WebSocket
    setSending(true);
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const s = getChatSocket();
    s.emit('send_message', {
      receiverId: partnerId,
      content: hasText ? text.trim() : undefined,
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      tempId,
    });

    // Optimistic: add message locally
    if (me) {
      const optimistic: Message = {
        id: '',
        senderId: me.id,
        receiverId: partnerId!,
        content: hasText ? text.trim() : null,
        mediaUrls,
        storyId: null,
        storyMediaUrl: null,
        readAt: null,
        sender: me,
        receiver: partner || ({} as User),
        createdAt: new Date().toISOString(),
        tempId,
      };
      setMessages((prev) => [...prev, optimistic]);
    }

    setText('');
    // Clean up previews
    mediaPreviews.forEach((p) => URL.revokeObjectURL(p.url));
    setMediaPreviews([]);
    setSending(false);
    isAtBottomRef.current = true;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Voice recording
  const startRecording = async () => {
    try {
      await recorder.start();
    } catch {
      toast.error('No se pudo acceder al micrófono');
    }
  };

  const stopAndSendVoice = async () => {
    const audioFile = await recorder.stop();
    if (!audioFile || !me) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('media', audioFile);
      const { data } = await api.post('/messages/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const mediaUrls: string[] = data.urls;
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const s = getChatSocket();
      s.emit('send_message', {
        receiverId: partnerId,
        mediaUrls,
        tempId,
      });
      const optimistic: Message = {
        id: '',
        senderId: me.id,
        receiverId: partnerId!,
        content: null,
        mediaUrls,
        storyId: null,
        storyMediaUrl: null,
        readAt: null,
        sender: me,
        receiver: partner || ({} as User),
        createdAt: new Date().toISOString(),
        tempId,
      };
      setMessages((prev) => [...prev, optimistic]);
      isAtBottomRef.current = true;
    } catch {
      toast.error('Error al enviar audio');
    } finally {
      setUploading(false);
    }
  };

  function fmtElapsed(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  // Delete message handlers
  const handleDeleteForMe = async (msgId: string) => {
    try {
      await api.delete(`/messages/${msgId}/for-me`);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch {
      toast.error('Error al eliminar mensaje');
    }
  };

  const handleDeleteForAll = async (msgId: string) => {
    try {
      await api.delete(`/messages/${msgId}/for-all`);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, deletedForAll: true, content: null, mediaUrls: [] } : m,
        ),
      );
    } catch {
      toast.error('Error al eliminar mensaje');
    }
  };

  // Group messages by date
  const groupedMessages = groupByDate(messages);

  if (!partner) {
    return (
      <div className="flex justify-center py-20">
        <LoadingLogo size="md" text="" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-64px)] md:h-[calc(100vh-theme(spacing.6)*2)] -mx-4 -mt-6 -mb-20 md:mx-0 md:mt-0 md:mb-0">
      {/* Header */}
      <div className="bg-white md:card flex items-center gap-3 px-4 py-3 md:mb-2 flex-shrink-0 border-b border-gray-100 md:border-b-0">
        <button
          onClick={() => router.push('/messages')}
          className="rounded-full p-1.5 transition hover:bg-gray-100 active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar
          src={partner.avatarUrl}
          alt={partner.displayName}
          size={40}
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            {partner.displayName}
          </p>
          <p className="text-xs text-gray-500">
            {partnerTyping ? (
              <span className="text-primary-600 animate-pulse">
                Escribiendo...
              </span>
            ) : partnerOnline ? (
              <span className="text-green-500 font-medium">En línea</span>
            ) : partnerLastSeen ? (
              <span>últ. vez {timeAgo(partnerLastSeen)}</span>
            ) : (
              `@${partner.username}`
            )}
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-white md:card md:mb-2"
      >
        {loadingHistory && (
          <div className="flex justify-center py-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
          </div>
        )}

        {groupedMessages.map(([dateLabel, msgs]) => (
          <div key={dateLabel}>
            <div className="flex justify-center my-3">
              <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-500">
                {dateLabel}
              </span>
            </div>
            {msgs.map((msg, i) => (
              <MessageBubble
                key={msg.id || msg.tempId || i}
                message={msg}
                isMine={msg.senderId === me?.id}
                onOpenLightbox={(urls, idx) => setLightbox({ urls, index: idx })}
                onDeleteForMe={handleDeleteForMe}
                onDeleteForAll={handleDeleteForAll}
              />
            ))}
          </div>
        ))}

        {partnerTyping && <TypingBubble />}
        <div ref={messagesEndRef} />
      </div>

      {/* Media previews */}
      {mediaPreviews.length > 0 && (
        <div className="bg-white px-3 py-2 flex-shrink-0 md:card md:mb-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {mediaPreviews.map((p, i) => (
              <div key={i} className="relative flex-shrink-0 h-20 w-20 rounded-lg overflow-hidden bg-gray-100">
                {p.type === 'video' ? (
                  <div className="flex h-full w-full items-center justify-center bg-gray-900/80">
                    <Film className="h-6 w-6 text-white" />
                  </div>
                ) : (
                  <Image
                    src={p.url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                )}
                <button
                  onClick={() => removePreview(i)}
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white transition hover:bg-black/80"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload progress bar */}
      {uploading && (
        <div className="bg-white px-4 py-2 flex-shrink-0 md:card md:mb-2">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
            <div className="flex-1">
              <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary-600 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
            <span className="text-xs font-medium text-gray-500">
              {uploadProgress}%
            </span>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="bg-white border-t border-gray-100 md:card flex items-end gap-2 px-3 py-2 flex-shrink-0 safe-area-bottom">
        {recorder.recording ? (
          /* Recording UI */
          <div className="flex flex-1 items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-sm font-semibold text-red-500 tabular-nums shrink-0">{fmtElapsed(recorder.elapsed)}</span>
            <div className="flex-1 overflow-hidden">
              <LiveWaveform analyser={recorder.analyser} barCount={45} height={32} barColor="#ef4444" className="w-full" />
            </div>
            <button
              onClick={() => recorder.cancel()}
              className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-red-500 shrink-0"
              title="Cancelar"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              onClick={stopAndSendVoice}
              className="rounded-full bg-primary-600 p-2 text-white transition hover:bg-primary-700 shrink-0"
              title="Enviar"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        ) : (
          /* Normal input */
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            >
              <ImagePlus className="h-5 w-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                emitTyping();
              }}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition focus:border-primary-400 focus:bg-white max-h-24 overflow-y-auto"
              style={{ minHeight: '36px' }}
            />
            {text.trim().length > 0 || mediaPreviews.length > 0 ? (
              <button
                onClick={handleSend}
                disabled={sending || uploading}
                className="rounded-full bg-primary-600 p-2 text-white transition hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending || uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            ) : (
              <button
                onClick={startRecording}
                disabled={uploading}
                className="rounded-full bg-primary-600 p-2 text-white transition hover:bg-primary-700 disabled:opacity-40"
              >
                <Mic className="h-5 w-5" />
              </button>
            )}
          </>
        )}
      </div>
      {/* Lightbox */}
      {lightbox && (
        <MediaLightbox
          urls={lightbox.urls}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
          onChangeIndex={(idx) => setLightbox((prev) => prev ? { ...prev, index: idx } : null)}
        />
      )}
    </div>
  );
}

// ─── Message Bubble ────────────────────────────────────────────
function MessageBubble({
  message,
  isMine,
  onOpenLightbox,
  onDeleteForMe,
  onDeleteForAll,
}: {
  message: Message;
  isMine: boolean;
  onOpenLightbox: (urls: string[], index: number) => void;
  onDeleteForMe: (msgId: string) => void;
  onDeleteForAll: (msgId: string) => void;
}) {
  const bubbleRouter = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const msgStatus = isMine ? getMessageStatus(message) : null;

  const hasMedia = message.mediaUrls && message.mediaUrls.length > 0;
  const isTemp = !message.id;
  const isStoryReply = !!message.storyId && !!message.storyMediaUrl;
  const isDeleted = !!message.deletedForAll;

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  function getMediaUrl(url: string) {
    return url.startsWith('http') ? url : `/uploads/${url}`;
  }

  function isVideo(url: string) {
    return /\.(mp4|webm|mov|quicktime)$/i.test(url);
  }

  function isAudio(url: string) {
    return /\.(webm|ogg|mp3|wav|m4a|aac|opus)$/i.test(url) || url.includes('voice-');
  }

  const isVoiceMessage = hasMedia && !isStoryReply && message.mediaUrls.length === 1 && isAudio(message.mediaUrls[0]);

  // Deleted message
  if (isDeleted) {
    return (
      <div className={`flex mb-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
        <div
          className={`max-w-[75%] rounded-2xl px-3 py-2 border border-dashed ${
            isMine
              ? 'border-primary-300 bg-primary-50 rounded-br-md'
              : 'border-gray-300 bg-gray-50 rounded-bl-md'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Ban className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-[13px] italic text-gray-400">Se ha eliminado este mensaje</span>
          </div>
          <div className="flex items-center justify-end gap-1 text-[10px] mt-0.5 text-gray-300">
            <span>
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex mb-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}
      onContextMenu={(e) => {
        if (!message.id) return;
        e.preventDefault();
        setShowMenu(true);
      }}
    >
      {/* Delete menu */}
      {showMenu && (
        <div
          ref={menuRef}
          className={`absolute z-50 ${isMine ? 'right-0' : 'left-0'} top-0 -translate-y-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[180px]`}
        >
          <button
            onClick={() => { setShowMenu(false); onDeleteForMe(message.id); }}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            <Trash2 className="h-4 w-4 text-gray-400" />
            Eliminar para mí
          </button>
          {isMine && (
            <button
              onClick={() => { setShowMenu(false); onDeleteForAll(message.id); }}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition border-t border-gray-100"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar para todos
            </button>
          )}
        </div>
      )}

      <div
        className={`max-w-[75%] rounded-2xl ${isStoryReply ? 'p-0 overflow-hidden' : 'px-3 py-2'} ${
          isMine
            ? 'bg-primary-600 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-900 rounded-bl-md'
        } ${isTemp ? 'opacity-60' : ''}`}
      >
        {/* Voice note */}
        {isVoiceMessage && (
          <VoiceNotePlayer src={getMediaUrl(message.mediaUrls[0])} isMine={isMine} />
        )}

        {/* Story reply: show story media above the message */}
        {isStoryReply && (
          <div
            className="relative w-[200px] h-[120px] cursor-pointer group"
            onClick={() => bubbleRouter.push(`/stories?user=${isMine ? message.receiverId : message.senderId}`)}
          >
            <Image
              src={getMediaUrl(message.storyMediaUrl!)}
              alt="Historia"
              fill
              className="object-cover"
              sizes="200px"
            />
            <div className="absolute inset-0 bg-black/10 group-hover:bg-black/25 transition" />
            <div className="absolute bottom-1.5 left-2">
              <span className={`text-[10px] font-medium ${isMine ? 'text-white/80' : 'text-white/90'} drop-shadow`}>
                Ver historia
              </span>
            </div>
          </div>
        )}

        {/* Media (normal attachments, not story, not voice) */}
        {hasMedia && !isStoryReply && !isVoiceMessage && (
          <div
            className={`${
              message.mediaUrls.length === 1 ? 'max-w-[280px]' : 'grid grid-cols-2 gap-1 w-[280px]'
            } mb-1 overflow-hidden rounded-xl`}
          >
            {message.mediaUrls.map((url, i) => {
              const src = getMediaUrl(url);
              const isVid = isVideo(url);

              if (isVid) {
                return (
                  <div
                    key={i}
                    className="relative aspect-video bg-black rounded-lg overflow-hidden cursor-pointer min-h-[120px]"
                    onClick={() => onOpenLightbox(message.mediaUrls, i)}
                  >
                    <video
                      src={src}
                      muted
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="rounded-full bg-white/90 p-2">
                        <Play className="h-5 w-5 text-gray-900 fill-gray-900" />
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={i}
                  className="relative aspect-square bg-gray-200 rounded-lg overflow-hidden cursor-pointer min-h-[120px]"
                  onClick={() => onOpenLightbox(message.mediaUrls, i)}
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 60vw, 300px"
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Text */}
        {message.content && (
          <p className={`text-sm whitespace-pre-wrap break-words ${isStoryReply ? 'px-3 py-2' : ''}`}>
            {message.content}
          </p>
        )}

        {/* Time + Status */}
        <div
          className={`flex items-center justify-end gap-1 text-[10px] mt-0.5 ${
            isMine ? 'text-white/60' : 'text-gray-400'
          } ${isStoryReply ? 'px-3 pb-2' : ''}`}
        >
          <span>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {isMine && msgStatus && (
            <MessageStatus status={msgStatus} size={14} className={msgStatus === 'read' ? 'text-sky-400' : ''} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Group messages by date ───────────────────────────────────
function groupByDate(messages: Message[]): [string, Message[]][] {
  const groups = new Map<string, Message[]>();
  for (const msg of messages) {
    const d = new Date(msg.createdAt);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    let label: string;
    if (d.toDateString() === today.toDateString()) {
      label = 'Hoy';
    } else if (d.toDateString() === yesterday.toDateString()) {
      label = 'Ayer';
    } else {
      label = d.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      });
    }

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(msg);
  }
  return Array.from(groups.entries());
}
