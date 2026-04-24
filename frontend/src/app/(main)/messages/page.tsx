'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Search, Sparkles } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { ConversationPreview } from '@/lib/types';
import Avatar from '@/components/Avatar';
import { timeAgo } from '@/lib/timeago';
import { connectChatSocket, disconnectChatSocket, getChatSocket } from '@/lib/chatSocket';
import LoadingLogo from '@/components/LoadingLogo';

export default function MessagesPage() {
  const me = useAuthStore((s) => s.user);
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const filteredConversations = conversations.filter((conv) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      conv.partnerDisplayName.toLowerCase().includes(q) ||
      conv.partnerUsername.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    api
      .get('/messages/conversations')
      .then((r) => setConversations(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Listen for new messages to update conversation list in real-time
  useEffect(() => {
    if (!me) return;
    connectChatSocket();
    const s = getChatSocket();

    const onNewMessage = (msg: any) => {
      setConversations((prev) => {
        const partnerId = msg.senderId === me.id ? msg.receiverId : msg.senderId;
        const partner = msg.senderId === me.id ? msg.receiver : msg.sender;
        const existing = prev.find((c) => c.partnerId === partnerId);
        const updated: ConversationPreview = {
          partnerId,
          partnerUsername: partner?.username ?? existing?.partnerUsername ?? '',
          partnerDisplayName: partner?.displayName ?? existing?.partnerDisplayName ?? '',
          partnerAvatarUrl: partner?.avatarUrl ?? existing?.partnerAvatarUrl ?? null,
          lastMessage: msg,
          unreadCount: msg.senderId !== me.id ? (existing?.unreadCount ?? 0) + 1 : (existing?.unreadCount ?? 0),
        };
        const filtered = prev.filter((c) => c.partnerId !== partnerId);
        return [updated, ...filtered];
      });
    };

    s.on('new_message', onNewMessage);
    s.on('message_sent', onNewMessage);

    return () => {
      s.off('new_message', onNewMessage);
      s.off('message_sent', onNewMessage);
    };
  }, [me]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="card p-4 sm:p-5">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="mt-3 h-10 animate-pulse rounded-xl bg-gray-100" />
        </div>
        <div className="card p-4 sm:p-5">
          <div className="flex justify-center py-10">
            <LoadingLogo size="md" text="" />
          </div>
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-7 text-white">
          <div className="flex items-center gap-2 text-sm/none font-semibold opacity-90">
            <Sparkles className="h-4 w-4" />
            Bandeja
          </div>
          <h1 className="mt-2 text-2xl font-bold">Mensajes</h1>
          <p className="mt-1 text-sm text-white/85">Tus conversaciones aparecerán aquí.</p>
        </div>
        <div className="py-14 text-center text-gray-400">
          <MessageCircle className="mx-auto mb-3 h-12 w-12" strokeWidth={1.4} />
          <p className="text-lg font-medium text-gray-700">No hay mensajes aún</p>
          <p className="mt-1 text-sm">Envía un mensaje desde el perfil de alguien</p>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 -mt-6 -mb-20 md:mx-0 md:mt-0 md:mb-0 md:space-y-4 min-h-[calc(100dvh-64px)] md:min-h-0 flex flex-col md:block bg-white md:bg-transparent">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-5 py-4 md:py-5 text-white md:rounded-t-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/85 hidden md:block">Inbox</p>
            <h1 className="text-xl md:text-2xl font-bold">Mensajes</h1>
          </div>
          <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
            {conversations.length} chats
          </div>
        </div>
        <div className="relative mt-3 md:mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/75" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conversación..."
            className="w-full rounded-xl border border-white/30 bg-white/15 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-white/75 outline-none ring-0 backdrop-blur transition focus:border-white/60 focus:bg-white/20"
          />
        </div>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 md:card md:rounded-t-none">
        {filteredConversations.map((conv) => {
          const lm = conv.lastMessage;
          let preview = '';
          if (lm.content) {
            preview = lm.content.length > 60 ? lm.content.slice(0, 60) + '...' : lm.content;
          } else if (lm.mediaUrls?.length > 0) {
            const hasVideo = lm.mediaUrls.some((u: string) => /\.(mp4|webm|mov)$/i.test(u));
            preview = hasVideo ? '🎬 Video' : '📷 Imagen';
            if (lm.mediaUrls.length > 1) preview += ` +${lm.mediaUrls.length - 1}`;
          }

          return (
            <button
              key={conv.partnerId}
              onClick={() => router.push(`/messages/${conv.partnerId}`)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-gray-50 active:bg-gray-100 sm:px-5"
            >
              <div className="relative shrink-0">
                <Avatar
                  src={conv.partnerAvatarUrl}
                  alt={conv.partnerDisplayName}
                  size={50}
                />
                {conv.unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-primary-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`truncate text-[15px] ${conv.unreadCount > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                    {conv.partnerDisplayName}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                    {timeAgo(lm.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-gray-900 font-semibold' : 'text-gray-500'}`}>
                    {lm.senderId === me?.id && <span className="text-gray-400">Tú: </span>}
                    {preview}
                  </p>
                  {conv.unreadCount > 0 && (
                    <span className="ml-2 flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[10px] font-bold text-white">
                      {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
        {filteredConversations.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-gray-400">
            No se encontraron conversaciones para <span className="font-semibold text-gray-500">"{query}"</span>
          </div>
        )}
      </div>
    </div>
  );
}
