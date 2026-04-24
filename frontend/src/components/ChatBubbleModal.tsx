'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { X, Send, Maximize2, Minimize2, ImagePlus, Loader2, Play, Mic, Trash2, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { connectChatSocket, getChatSocket } from '@/lib/chatSocket';
import type { Message } from '@/lib/types';
import Avatar from './Avatar';
import MediaLightbox from './MediaLightbox';
import MessageStatus, { getMessageStatus } from './MessageStatus';
import TypingBubble from './TypingBubble';
import VoiceNotePlayer from './VoiceNotePlayer';
import LiveWaveform from './LiveWaveform';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { getSocket } from '@/lib/socket';
import { timeAgo } from '@/lib/timeago';

const MAX_FILES = 5;
const MAX_SIZE = 50 * 1024 * 1024;

function getMediaUrl(url: string) {
  return url.startsWith('http') ? url : `/uploads/${url}`;
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov|quicktime)$/i.test(url);
}

function isAudioUrl(url: string) {
  return /\.(webm|ogg|mp3|wav|m4a|aac|opus)$/i.test(url) || url.includes('voice-');
}

interface Friend {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  online: boolean;
  lastSeen?: string | null;
}

interface Props {
  friend: Friend;
  onClose: () => void;
}

export default function ChatBubbleModal({ friend, onClose }: Props) {
  const me = useAuthStore((s) => s.user);
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [mediaPreviews, setMediaPreviews] = useState<{ file: File; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [isOnline, setIsOnline] = useState(friend.online);
  const [lastSeen, setLastSeen] = useState<string | null>(friend.lastSeen ?? null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorder = useAudioRecorder();

  // Fetch recent messages
  const fetchMessages = useCallback(async () => {
    try {
      const { data } = await api.get(
        `/messages/conversation/${friend.id}?limit=30`,
      );
      setMessages(data.items ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [friend.id]);

  useEffect(() => {
    fetchMessages();
    api.patch(`/messages/${friend.id}/read`).catch(() => {});
  }, [fetchMessages, friend.id]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, minimized]);

  // WebSocket
  useEffect(() => {
    if (!me) return;
    connectChatSocket();
    const s = getChatSocket();

    const onMsg = (msg: Message) => {
      if (msg.senderId === friend.id || msg.receiverId === friend.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
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
        if (msg.senderId === friend.id) {
          s.emit('mark_read', { partnerId: friend.id });
        }
      }
    };

    const onTyping = (d: { userId: string }) => {
      if (d.userId === friend.id) {
        setPartnerTyping(true);
        setTimeout(() => setPartnerTyping(false), 3000);
      }
    };
    const onStopTyping = (d: { userId: string }) => {
      if (d.userId === friend.id) setPartnerTyping(false);
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
      if (d.readBy === friend.id) {
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

    s.on('new_message', onMsg);
    s.on('message_sent', onMsg);
    s.on('user_typing', onTyping);
    s.on('user_stop_typing', onStopTyping);
    s.on('message_delivered', onDelivered);
    s.on('messages_read', onMessagesRead);
    s.on('message_deleted_for_all', onDeletedForAll);

    return () => {
      s.off('new_message', onMsg);
      s.off('message_sent', onMsg);
      s.off('user_typing', onTyping);
      s.off('user_stop_typing', onStopTyping);
      s.off('message_delivered', onDelivered);
      s.off('messages_read', onMessagesRead);
      s.off('message_deleted_for_all', onDeletedForAll);
    };
  }, [me, friend.id]);

  // Track online/offline via realtime socket
  useEffect(() => {
    setIsOnline(friend.online);
  }, [friend.online]);

  useEffect(() => {
    const rs = getSocket();
    const onOnline = (d: { userId: string }) => {
      if (d.userId === friend.id) setIsOnline(true);
    };
    const onOffline = (d: { userId: string; lastSeen?: string }) => {
      if (d.userId === friend.id) {
        setIsOnline(false);
        if (d.lastSeen) setLastSeen(d.lastSeen);
      }
    };
    rs.on('user_online', onOnline);
    rs.on('user_offline', onOffline);
    return () => {
      rs.off('user_online', onOnline);
      rs.off('user_offline', onOffline);
    };
  }, [friend.id]);

  const emitTyping = () => {
    const s = getChatSocket();
    s.emit('typing', { receiverId: friend.id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      s.emit('stop_typing', { receiverId: friend.id });
    }, 2000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (mediaPreviews.length + files.length > MAX_FILES) {
      toast.error(`Máximo ${MAX_FILES} archivos`);
      return;
    }
    const newPreviews = files
      .filter((f) => {
        if (f.size > MAX_SIZE) { toast.error(`${f.name} excede 50 MB`); return false; }
        return true;
      })
      .map((f) => ({ file: f, url: URL.createObjectURL(f) }));
    setMediaPreviews((prev) => [...prev, ...newPreviews]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePreview = (i: number) => {
    setMediaPreviews((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const handleSend = async () => {
    const hasText = text.trim().length > 0;
    const hasMedia = mediaPreviews.length > 0;
    if ((!hasText && !hasMedia) || !me || uploading) return;

    let mediaUrls: string[] = [];
    if (hasMedia) {
      setUploading(true);
      try {
        const fd = new FormData();
        mediaPreviews.forEach((p) => fd.append('media', p.file));
        const { data } = await api.post('/messages/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        mediaUrls = data.urls;
      } catch {
        toast.error('Error al subir archivos');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const s = getChatSocket();
    s.emit('send_message', {
      receiverId: friend.id,
      content: hasText ? text.trim() : undefined,
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      tempId,
    });

    const optimistic: Message = {
      id: '',
      senderId: me.id,
      receiverId: friend.id,
      content: hasText ? text.trim() : null,
      mediaUrls,
      storyId: null,
      storyMediaUrl: null,
      readAt: null,
      sender: me,
      receiver: {} as any,
      createdAt: new Date().toISOString(),
      tempId,
    };
    setMessages((prev) => [...prev, optimistic]);
    setText('');
    mediaPreviews.forEach((p) => URL.revokeObjectURL(p.url));
    setMediaPreviews([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startRecording = async () => {
    try { await recorder.start(); } catch { toast.error('No se pudo acceder al micrófono'); }
  };

  const stopAndSendVoice = async () => {
    const audioFile = await recorder.stop();
    if (!audioFile || !me) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('media', audioFile);
      const { data } = await api.post('/messages/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const mediaUrls: string[] = data.urls;
      const tempId = `temp-${Date.now()}-${Math.random()}`;
      const s = getChatSocket();
      s.emit('send_message', { receiverId: friend.id, mediaUrls, tempId });
      const optimistic: Message = {
        id: '', senderId: me.id, receiverId: friend.id, content: null, mediaUrls,
        storyId: null, storyMediaUrl: null, readAt: null,
        sender: me, receiver: {} as any, createdAt: new Date().toISOString(), tempId,
      };
      setMessages((prev) => [...prev, optimistic]);
    } catch { toast.error('Error al enviar audio'); }
    setUploading(false);
  };

  function fmtElapsed(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  const handleDeleteForMe = async (msgId: string) => {
    try {
      await api.delete(`/messages/${msgId}/for-me`);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch { toast.error('Error al eliminar'); }
  };

  const handleDeleteForAll = async (msgId: string) => {
    try {
      await api.delete(`/messages/${msgId}/for-all`);
      setMessages((prev) =>
        prev.map((m) => m.id === msgId ? { ...m, deletedForAll: true, content: null, mediaUrls: [] } : m),
      );
    } catch { toast.error('Error al eliminar'); }
  };

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-t-xl border border-gray-200 bg-white shadow-2xl transition-all duration-200 ${
        minimized ? 'h-[48px]' : 'h-[400px]'
      } w-[320px]`}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 border-b border-gray-100 bg-white px-3 py-2.5 cursor-pointer select-none"
        onClick={() => setMinimized((p) => !p)}
      >
        <div className="relative shrink-0">
          <Avatar src={friend.avatarUrl} alt={friend.displayName} size={28} />
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
              isOnline ? 'bg-green-500' : 'bg-gray-300'
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-gray-900">
            {friend.displayName}
          </p>
          {!minimized && (
            <p className="text-[10px]">
              {partnerTyping ? (
                <span className="text-primary-600 animate-pulse">Escribiendo...</span>
              ) : isOnline ? (
                <span className="text-green-500">En línea</span>
              ) : lastSeen ? (
                <span className="text-gray-400">últ. vez {timeAgo(lastSeen)}</span>
              ) : null}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); setMinimized((p) => !p); }}
            className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            {minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-red-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      {!minimized && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1 bg-gray-50">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-xs text-gray-400">Sin mensajes aún</p>
                <p className="text-[10px] text-gray-300">Envía el primer mensaje</p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const isMine = msg.senderId === me?.id;
                const isTemp = !msg.id;
                const hasMedia = msg.mediaUrls && msg.mediaUrls.length > 0;
                const isStoryReply = !!msg.storyId && !!msg.storyMediaUrl;
                const isVoiceMsg = hasMedia && !isStoryReply && msg.mediaUrls.length === 1 && isAudioUrl(msg.mediaUrls[0]);
                const isDeleted = !!msg.deletedForAll;

                if (isDeleted) {
                  return (
                    <div key={msg.id || msg.tempId || i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-2.5 py-1.5 border border-dashed ${
                        isMine ? 'border-primary-300 bg-primary-50 rounded-br-md' : 'border-gray-300 bg-gray-50 rounded-bl-md'
                      }`}>
                        <div className="flex items-center gap-1">
                          <Ban className="h-3 w-3 text-gray-400" />
                          <span className="text-[11px] italic text-gray-400">Se ha eliminado este mensaje</span>
                        </div>
                        <div className="flex justify-end text-[9px] text-gray-300 mt-0.5">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <MiniChatBubble
                    key={msg.id || msg.tempId || i}
                    msg={msg}
                    isMine={isMine}
                    isTemp={isTemp}
                    hasMedia={hasMedia}
                    isStoryReply={isStoryReply}
                    isVoiceMsg={isVoiceMsg}
                    onOpenLightbox={(urls, idx) => setLightbox({ urls, index: idx })}
                    onOpenStory={(userId) => router.push(`/stories?user=${userId}`)}
                    onDeleteForMe={handleDeleteForMe}
                    onDeleteForAll={handleDeleteForAll}
                  />
                );
              })
            )}
            {partnerTyping && <TypingBubble />}
            <div ref={messagesEndRef} />
          </div>

          {/* Media previews */}
          {mediaPreviews.length > 0 && (
            <div className="flex gap-1 overflow-x-auto border-t border-gray-100 bg-white px-2.5 py-1.5">
              {mediaPreviews.map((p, i) => (
                <div key={i} className="relative h-12 w-12 shrink-0 rounded-md overflow-hidden bg-gray-100">
                  {p.file.type.startsWith('video/') ? (
                    <div className="flex h-full w-full items-center justify-center bg-gray-900/80"><Play className="h-4 w-4 text-white" /></div>
                  ) : (
                    <Image src={p.url} alt="" fill className="object-cover" sizes="48px" />
                  )}
                  <button onClick={() => removePreview(i)} className="absolute right-0 top-0 rounded-full bg-black/60 p-0.5 text-white">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-1 border-t border-gray-100 bg-white px-2 py-1.5">
            {recorder.recording ? (
              <div className="flex flex-1 items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                <span className="text-[10px] font-semibold text-red-500 tabular-nums shrink-0">{fmtElapsed(recorder.elapsed)}</span>
                <div className="flex-1 overflow-hidden">
                  <LiveWaveform analyser={recorder.analyser} barCount={30} height={24} barColor="#ef4444" className="w-full" />
                </div>
                <button onClick={() => recorder.cancel()} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 shrink-0"><X className="h-3.5 w-3.5" /></button>
                <button onClick={stopAndSendVoice} className="shrink-0 rounded-full bg-primary-600 p-1.5 text-white hover:bg-primary-700"><Send className="h-4 w-4" /></button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="shrink-0 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                >
                  <ImagePlus className="h-4 w-4" />
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
                  onChange={(e) => { setText(e.target.value); emitTyping(); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe un mensaje..."
                  rows={1}
                  className="flex-1 resize-none rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[12px] outline-none transition focus:border-primary-400 focus:bg-white max-h-16 overflow-y-auto"
                  style={{ minHeight: '32px' }}
                />
                {text.trim().length > 0 || mediaPreviews.length > 0 ? (
                  <button
                    onClick={handleSend}
                    disabled={uploading}
                    className="shrink-0 rounded-full bg-primary-600 p-1.5 text-white transition hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                ) : (
                  <button
                    onClick={startRecording}
                    disabled={uploading}
                    className="shrink-0 rounded-full bg-primary-600 p-1.5 text-white transition hover:bg-primary-700 disabled:opacity-40"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}

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

// ─── Mini Chat Bubble (with context menu) ─────────────────────
function MiniChatBubble({
  msg,
  isMine,
  isTemp,
  hasMedia,
  isStoryReply,
  isVoiceMsg,
  onOpenLightbox,
  onOpenStory,
  onDeleteForMe,
  onDeleteForAll,
}: {
  msg: Message;
  isMine: boolean;
  isTemp: boolean;
  hasMedia: boolean;
  isStoryReply: boolean;
  isVoiceMsg: boolean;
  onOpenLightbox: (urls: string[], index: number) => void;
  onOpenStory: (userId: string) => void;
  onDeleteForMe: (msgId: string) => void;
  onDeleteForAll: (msgId: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  return (
    <div
      className={`relative flex ${isMine ? 'justify-end' : 'justify-start'}`}
      onContextMenu={(e) => {
        if (!msg.id) return;
        e.preventDefault();
        setShowMenu(true);
      }}
    >
      {/* Delete menu */}
      {showMenu && (
        <div
          ref={menuRef}
          className={`absolute z-50 ${isMine ? 'right-0' : 'left-0'} top-0 -translate-y-full bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden min-w-[150px]`}
        >
          <button
            onClick={() => { setShowMenu(false); onDeleteForMe(msg.id); }}
            className="flex items-center gap-1.5 w-full px-2.5 py-2 text-[11px] text-gray-700 hover:bg-gray-50 transition"
          >
            <Trash2 className="h-3 w-3 text-gray-400" />
            Eliminar para mí
          </button>
          {isMine && (
            <button
              onClick={() => { setShowMenu(false); onDeleteForAll(msg.id); }}
              className="flex items-center gap-1.5 w-full px-2.5 py-2 text-[11px] text-red-600 hover:bg-red-50 transition border-t border-gray-100"
            >
              <Trash2 className="h-3 w-3" />
              Eliminar para todos
            </button>
          )}
        </div>
      )}

      <div
        className={`max-w-[85%] rounded-2xl overflow-hidden ${isStoryReply || (hasMedia && !isVoiceMsg) ? 'p-0' : 'px-2.5 py-1.5'} ${
          isMine
            ? 'bg-primary-600 text-white rounded-br-md'
            : 'bg-white text-gray-900 rounded-bl-md border border-gray-100'
        } ${isTemp ? 'opacity-60' : ''}`}
      >
        {isVoiceMsg && (
          <VoiceNotePlayer src={getMediaUrl(msg.mediaUrls[0])} isMine={isMine} compact />
        )}
        {isStoryReply && (
          <div
            className="relative w-[180px] h-[100px] cursor-pointer"
            onClick={() => onOpenStory(isMine ? msg.receiverId : msg.senderId)}
          >
            <Image src={getMediaUrl(msg.storyMediaUrl!)} alt="Historia" fill className="object-cover" sizes="180px" />
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute bottom-1 left-2">
              <span className="text-[9px] font-medium text-white drop-shadow">Historia</span>
            </div>
          </div>
        )}
        {hasMedia && !isStoryReply && !isVoiceMsg && (
          <div className={`${msg.mediaUrls.length === 1 ? 'w-[200px]' : 'grid grid-cols-2 gap-0.5 w-[220px]'} overflow-hidden`}>
            {msg.mediaUrls.map((url, mi) => {
              const src = getMediaUrl(url);
              const isVid = isVideoUrl(url);
              return (
                <div
                  key={mi}
                  className="relative aspect-square bg-gray-200 cursor-pointer min-h-[100px]"
                  onClick={() => onOpenLightbox(msg.mediaUrls, mi)}
                >
                  {isVid ? (
                    <>
                      <video src={src} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="rounded-full bg-white/90 p-1"><Play className="h-3 w-3 text-gray-900 fill-gray-900" /></div>
                      </div>
                    </>
                  ) : (
                    <Image src={src} alt="" fill className="object-cover" sizes="140px" />
                  )}
                </div>
              );
            })}
          </div>
        )}
        {msg.content && (
          <p className={`text-[12px] whitespace-pre-wrap break-words leading-relaxed ${hasMedia || isStoryReply ? 'px-2.5 pt-1' : ''}`}>
            {msg.content}
          </p>
        )}
        <div
          className={`flex items-center justify-end gap-0.5 text-[9px] mt-0.5 ${hasMedia || isStoryReply ? 'px-2.5 pb-1' : ''} ${
            isMine ? 'text-white/50' : 'text-gray-400'
          }`}
        >
          <span>
            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isMine && (
            <MessageStatus
              status={getMessageStatus(msg)}
              size={12}
              className={getMessageStatus(msg) === 'read' ? 'text-sky-400' : ''}
            />
          )}
        </div>
      </div>
    </div>
  );
}
