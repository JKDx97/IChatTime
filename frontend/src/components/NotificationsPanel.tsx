'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Bell, Heart, MessageCircle, Reply, UserPlus, UserCheck, UserX, Users, X, Trash2 } from 'lucide-react';
import { timeAgo, formatExactDate } from '@/lib/timeago';
import api from '@/lib/api';
import type { Notification } from '@/lib/types';
import Avatar from './Avatar';

const ICONS: Record<string, React.ReactNode> = {
  like: <Heart className="h-4 w-4 text-red-500" />,
  comment: <MessageCircle className="h-4 w-4 text-primary-500" />,
  comment_reply: <Reply className="h-4 w-4 text-primary-500" />,
  follow: <UserPlus className="h-4 w-4 text-green-500" />,
  story_like: <Heart className="h-4 w-4 text-pink-500" />,
  friend_request: <Users className="h-4 w-4 text-purple-500" />,
  friend_accept: <UserCheck className="h-4 w-4 text-blue-500" />,
};

interface Props {
  open: boolean;
  onClose: () => void;
  onRead: () => void;
  onOpenPost: (postId: string) => void;
}

export default function NotificationsPanel({ open, onClose, onRead, onOpenPost }: Props) {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        const { data } = await api.get('/notifications');
        setNotifs(data.items ?? data);
        await api.post('/notifications/read-all');
        onRead();
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [open, onRead]);

  async function handleDeleteOne(id: string) {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    try { await api.delete(`/notifications/${id}`); } catch { /* ignore */ }
  }

  async function handleDeleteAll() {
    setDeletingAll(true);
    try {
      await api.delete('/notifications');
      setNotifs([]);
    } catch { /* ignore */ }
    setDeletingAll(false);
  }

  async function handleFriendAction(n: Notification, action: 'accept' | 'reject') {
    if (!n.entityId || actionBusy) return;
    setActionBusy(n.id);
    try {
      await api.post(`/friend-requests/${n.entityId}/${action}`);
      setNotifs((prev) =>
        prev.map((item) =>
          item.id === n.id
            ? { ...item, message: action === 'accept' ? 'solicitud aceptada ✓' : 'solicitud rechazada', type: action === 'accept' ? 'friend_accept' : 'follow' }
            : item,
        ),
      );
    } catch { /* ignore */ }
    setActionBusy(null);
  }

  function handleClick(n: Notification) {
    if (n.entityType === 'post' && n.entityId) {
      onClose();
      onOpenPost(n.entityId);
    } else if (n.entityType === 'story' && n.entityId) {
      onClose();
      router.push(`/stories?user=${n.actor?.id ?? ''}`);
    } else if (n.type === 'follow' || n.type === 'friend_accept') {
      onClose();
      router.push(`/profile/${n.actor?.username}`);
    } else if (n.type === 'friend_request') {
      onClose();
      router.push(`/profile/${n.actor?.username}`);
    }
  }

  function getMediaUrl(url: string) {
    return url.startsWith('http') ? url : `/uploads/${url}`;
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:bg-transparent"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed inset-y-0 z-40 flex w-[360px] flex-col border-r border-gray-200 bg-white shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          md:left-[72px] xl:left-[72px]
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-6">
          <h2 className="text-2xl font-bold text-gray-900">Notificaciones</h2>
          <div className="flex items-center gap-1">
            {notifs.length > 0 && (
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                title="Borrar todas"
                className="rounded-full p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
              >
                <Trash2 className="h-4.5 w-4.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
            </div>
          ) : notifs.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Bell className="mx-auto mb-3 h-10 w-10" />
              <p className="text-sm font-medium">Sin notificaciones</p>
              <p className="mt-1 text-xs">Cuando alguien interactúe contigo, aparecerá aquí.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {notifs.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex items-center gap-3 px-4 py-3.5 transition-all duration-150 hover:bg-gray-50 cursor-pointer ${!n.readAt ? 'bg-primary-50/40' : ''}`}
                >
                  <Avatar src={n.actor?.avatarUrl} alt={n.actor?.displayName} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] leading-snug">
                      <span className="font-semibold">{n.actor?.username ?? n.actor?.displayName}</span>{' '}
                      <span className="text-gray-600">{n.message}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400" title={formatExactDate(n.createdAt)}>
                      {timeAgo(n.createdAt)}
                    </p>
                    {n.type === 'friend_request' && n.entityId && (
                      <div className="mt-1.5 flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleFriendAction(n, 'accept')}
                          disabled={actionBusy === n.id}
                          className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
                        >
                          <UserCheck className="h-3 w-3" /> Aceptar
                        </button>
                        <button
                          onClick={() => handleFriendAction(n, 'reject')}
                          disabled={actionBusy === n.id}
                          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1 text-[11px] font-semibold text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
                        >
                          <UserX className="h-3 w-3" /> Rechazar
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {/* Thumbnail of the post/story */}
                    {n.entityMediaUrl ? (
                      <div className="relative h-10 w-10 shrink-0 rounded-md overflow-hidden bg-gray-100">
                        <Image
                          src={getMediaUrl(n.entityMediaUrl)}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                    ) : (
                      <div className="shrink-0">
                        {ICONS[n.type] ?? <Bell className="h-4 w-4 text-gray-400" />}
                      </div>
                    )}
                    {/* Delete button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteOne(n.id); }}
                      title="Eliminar"
                      className="rounded-full p-1 text-gray-300 transition hover:bg-red-50 hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
