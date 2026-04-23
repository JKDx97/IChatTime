'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Users, X } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { getSocket } from '@/lib/socket';
import Avatar from './Avatar';
import ChatBubbleModal from './ChatBubbleModal';

interface Friend {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  online: boolean;
  since: string;
  lastSeen?: string | null;
}

function FriendsList({
  friends,
  loading,
  onSelect,
}: {
  friends: Friend[];
  loading: boolean;
  onSelect: (friend: Friend) => void;
}) {
  const onlineFriends = friends.filter((f) => f.online);
  const offlineFriends = friends.filter((f) => !f.online);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <Users className="mx-auto mb-2 h-8 w-8 text-gray-300" />
        <p className="text-sm font-medium text-gray-400">Sin amigos aún</p>
        <p className="mt-1 text-xs text-gray-300">Envía solicitudes desde los perfiles</p>
      </div>
    );
  }

  return (
    <>
      {onlineFriends.length > 0 && (
        <div>
          <div className="sticky top-0 bg-white px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-green-600">
              En línea — {onlineFriends.length}
            </p>
          </div>
          {onlineFriends.map((f) => (
            <button
              key={f.id}
              onClick={() => onSelect(f)}
              className="flex w-full items-center gap-3 px-4 py-2 transition-colors hover:bg-gray-50"
            >
              <div className="relative shrink-0">
                <Avatar src={f.avatarUrl} alt={f.displayName} size={34} />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[13px] font-semibold text-gray-900">{f.displayName}</p>
                <p className="truncate text-[11px] text-green-600">En línea</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {offlineFriends.length > 0 && (
        <div>
          <div className="sticky top-0 bg-white px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Desconectados — {offlineFriends.length}
            </p>
          </div>
          {offlineFriends.map((f) => (
            <button
              key={f.id}
              onClick={() => onSelect(f)}
              className="flex w-full items-center gap-3 px-4 py-2 transition-colors hover:bg-gray-50"
            >
              <div className="relative shrink-0">
                <Avatar src={f.avatarUrl} alt={f.displayName} size={34} />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-gray-300" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-[13px] font-medium text-gray-700">{f.displayName}</p>
                <p className="truncate text-[11px] text-gray-400">Desconectado</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export default function FriendsSidebar() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openChats, setOpenChats] = useState<Friend[]>([]);

  const fetchFriends = useCallback(async () => {
    try {
      const { data } = await api.get('/friend-requests/friends');
      setFriends(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchFriends();
  }, [user, fetchFriends]);

  useEffect(() => {
    const socket = getSocket();
    const handleOnline = ({ userId }: { userId: string }) => {
      setFriends((prev) => prev.map((f) => (f.id === userId ? { ...f, online: true } : f)));
    };
    const handleOffline = ({ userId, lastSeen }: { userId: string; lastSeen?: string }) => {
      setFriends((prev) => prev.map((f) => (f.id === userId ? { ...f, online: false, lastSeen: lastSeen ?? f.lastSeen } : f)));
    };
    socket.on('user_online', handleOnline);
    socket.on('user_offline', handleOffline);
    return () => {
      socket.off('user_online', handleOnline);
      socket.off('user_offline', handleOffline);
    };
  }, []);

  const onlineCount = friends.filter((f) => f.online).length;

  function handleOpenChat(friend: Friend) {
    setMobileOpen(false);
    setOpenChats((prev) => {
      if (prev.some((f) => f.id === friend.id)) return prev;
      // Max 3 open chats
      const next = [...prev, friend];
      return next.length > 3 ? next.slice(-3) : next;
    });
  }

  function handleCloseChat(friendId: string) {
    setOpenChats((prev) => prev.filter((f) => f.id !== friendId));
  }

  // Keep online status synced in open chats
  useEffect(() => {
    setOpenChats((prev) =>
      prev.map((c) => {
        const updated = friends.find((f) => f.id === c.id);
        return updated ? { ...c, online: updated.online } : c;
      }),
    );
  }, [friends]);

  if (!user) return null;

  return (
    <>
      {/* ══ Desktop / Tablet fixed sidebar (md+) ══ */}
      <aside className="fixed right-0 top-0 z-30 hidden h-screen w-[220px] flex-col border-l border-gray-200 bg-white md:flex">
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-5">
          <Users className="h-5 w-5 text-gray-600" />
          <h2 className="text-sm font-bold text-gray-900">Amigos</h2>
          <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
            {friends.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <FriendsList friends={friends} loading={loading} onSelect={handleOpenChat} />
        </div>
      </aside>

      {/* ══ Mobile: floating button + drawer ══ */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg transition hover:bg-primary-700 active:scale-95 md:hidden"
      >
        <Users className="h-5 w-5" />
        {onlineCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-bold text-white">
            {onlineCount}
          </span>
        )}
      </button>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-[280px] flex-col bg-white shadow-xl transition-transform duration-300 md:hidden
          ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-5">
          <Users className="h-5 w-5 text-gray-600" />
          <h2 className="text-base font-bold text-gray-900">Amigos</h2>
          <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
            {friends.length}
          </span>
          <button onClick={() => setMobileOpen(false)} className="ml-1 rounded-full p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <FriendsList friends={friends} loading={loading} onSelect={handleOpenChat} />
        </div>
      </div>

      {/* ══ Chat bubble modals (bottom-right, next to sidebar) ══ */}
      <div className="fixed bottom-0 right-[228px] z-40 hidden items-end gap-2 md:flex">
        {openChats.map((f) => (
          <ChatBubbleModal
            key={f.id}
            friend={f}
            onClose={() => handleCloseChat(f.id)}
          />
        ))}
      </div>
      {/* Mobile: single chat modal full-width bottom */}
      {openChats.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
          <ChatBubbleModal
            friend={openChats[openChats.length - 1]}
            onClose={() => handleCloseChat(openChats[openChats.length - 1].id)}
          />
        </div>
      )}
    </>
  );
}
