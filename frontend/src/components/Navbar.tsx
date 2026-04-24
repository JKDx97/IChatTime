'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Home,
  Search,
  PlusSquare,
  Bell,
  LogOut,
  MessageCircle,
  Send,
  Zap,
  Image as ImageIcon,
  Film,
  Clock,
  FileText,
  Compass,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket';
import { connectChatSocket, disconnectChatSocket, getChatSocket } from '@/lib/chatSocket';
import Avatar from './Avatar';
import SearchPanel from './SearchPanel';
import NotificationsPanel from './NotificationsPanel';
import CreatePostModal from './CreatePostModal';
import CreateFlashModal from './CreateFlashModal';
import CreateStoryModal from './CreateStoryModal';
import CreateNoteModal from './CreateNoteModal';
import PostDetailModal from './PostDetailModal';
import api from '@/lib/api';
import type { Post } from '@/lib/types';

type PanelType = 'search' | 'notifications' | null;

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showCreateFlash, setShowCreateFlash] = useState(false);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [showCreateNote, setShowCreateNote] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const createMenuRef = useRef<HTMLDivElement>(null);

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    api.get('/notifications/unread-count').then((r) => setUnread(r.data.count)).catch(() => {});
    api.get('/messages/unread-count').then((r) => setUnreadMessages(r.data.count)).catch(() => {});
    connectSocket();
    const s = getSocket();
    const handler = () => setUnread((c) => c + 1);
    s.on('notification', handler);

    connectChatSocket();
    const cs = getChatSocket();
    const msgHandler = () => setUnreadMessages((c) => c + 1);
    cs.on('new_message', msgHandler);

    return () => {
      s.off('notification', handler); disconnectSocket();
      cs.off('new_message', msgHandler); disconnectChatSocket();
    };
  }, [userId]);

  // Close panels on route change
  useEffect(() => {
    setActivePanel(null);
    setCreateMenuOpen(false);
  }, [pathname]);

  // Close create menu on outside click
  useEffect(() => {
    if (!createMenuOpen) return;
    function handleClick() {
      setCreateMenuOpen(false);
    }
    // Use setTimeout so this listener is added after the current event loop
    const id = setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => { clearTimeout(id); document.removeEventListener('click', handleClick); };
  }, [createMenuOpen]);

  // Listen for open-notifications event from mobile header
  useEffect(() => {
    const handler = () => setActivePanel('notifications');
    window.addEventListener('open-notifications', handler);
    return () => window.removeEventListener('open-notifications', handler);
  }, []);

  function openCreatePost() {
    setCreateMenuOpen(false);
    setShowCreatePost(true);
  }

  function openCreateFlash() {
    setCreateMenuOpen(false);
    setShowCreateFlash(true);
  }

  function openCreateStory() {
    setCreateMenuOpen(false);
    setShowCreateStory(true);
  }

  function openCreateNote() {
    setCreateMenuOpen(false);
    setShowCreateNote(true);
  }

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  function togglePanel(panel: PanelType) {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }

  const handleNotifRead = useCallback(() => setUnread(0), []);

  const handleOpenPostFromNotification = useCallback(async (postId: string) => {
    try {
      const { data } = await api.get(`/posts/${postId}`);
      setActivePost(data);
      setPostModalOpen(true);
    } catch {
      router.push('/feed');
    }
  }, [router]);

  if (!user) return null;

  const panelOpen = activePanel !== null;

  // Shared nav item renderer
  function renderNavButton(
    id: string,
    label: string,
    icon: React.ReactNode,
    activeIcon: React.ReactNode,
    onClick: () => void,
    isItemActive: boolean,
    badge?: number,
    showLabel = true,
  ) {
    return (
      <button
        key={id}
        onClick={onClick}
        className={`sidebar-link group relative flex items-center gap-4 rounded-xl px-3 py-3 text-[15px] transition-all duration-200 w-full text-left
          ${isItemActive
            ? 'bg-gray-100 font-semibold text-gray-900'
            : 'font-normal text-gray-700 hover:bg-gray-50 hover:text-gray-900'
          }`}
      >
        <span className={`relative transition-transform duration-200 group-hover:scale-110 group-active:scale-90 ${isItemActive ? 'text-gray-900' : ''}`}>
          {isItemActive ? activeIcon : icon}
          {badge && badge > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm animate-bounce-in">
              {badge > 99 ? '99+' : badge}
            </span>
          ) : null}
        </span>
        {showLabel && (
          <span className="transition-transform duration-200 group-hover:translate-x-0.5">
            {label}
          </span>
        )}
      </button>
    );
  }

  // Icon-only nav for tablet sidebar
  function renderNavIcon(
    id: string,
    label: string,
    icon: React.ReactNode,
    activeIcon: React.ReactNode,
    onClick: () => void,
    isItemActive: boolean,
    badge?: number,
  ) {
    return (
      <button
        key={id}
        onClick={onClick}
        title={label}
        className={`group relative flex items-center justify-center rounded-xl p-3 transition-all duration-200
          ${isItemActive
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
          }`}
      >
        <span className="relative transition-transform duration-200 group-hover:scale-110 group-active:scale-90">
          {isItemActive ? activeIcon : icon}
          {badge && badge > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm animate-bounce-in">
              {badge > 99 ? '99+' : badge}
            </span>
          ) : null}
        </span>
        <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1">
          {label}
        </span>
      </button>
    );
  }

  function renderCreateSubmenu(compact = false) {
    if (!createMenuOpen) return null;
    return (
      <div
        ref={createMenuRef}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-full top-0 ml-2 overflow-hidden rounded-xl bg-white shadow-lg border border-gray-200 animate-fade-in z-[100] min-w-[200px]"
      >
        <button
          onClick={openCreatePost}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50 active:bg-gray-100"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600 shrink-0">
            <ImageIcon className="h-4 w-4" />
          </div>
          {!compact && (
            <div className="text-left">
              <p className="font-semibold text-gray-900 text-[13px]">Publicación</p>
              <p className="text-[10px] text-gray-400">Foto o video</p>
            </div>
          )}
        </button>
        <button
          onClick={openCreateNote}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50 active:bg-gray-100"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 shrink-0">
            <FileText className="h-4 w-4" />
          </div>
          {!compact && (
            <div className="text-left">
              <p className="font-semibold text-gray-900 text-[13px]">Nota</p>
              <p className="text-[10px] text-gray-400">Solo texto</p>
            </div>
          )}
        </button>
        <button
          onClick={openCreateFlash}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50 active:bg-gray-100"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 shrink-0">
            <Film className="h-4 w-4" />
          </div>
          {!compact && (
            <div className="text-left">
              <p className="font-semibold text-gray-900 text-[13px]">Flash</p>
              <p className="text-[10px] text-gray-400">Video corto · máx 1:30</p>
            </div>
          )}
        </button>
        <button
          onClick={openCreateStory}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50 active:bg-gray-100"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fuchsia-50 text-fuchsia-600 shrink-0">
            <Clock className="h-4 w-4" />
          </div>
          {!compact && (
            <div className="text-left">
              <p className="font-semibold text-gray-900 text-[13px]">Historia</p>
              <p className="text-[10px] text-gray-400">Desaparece en 24h</p>
            </div>
          )}
        </button>
      </div>
    );
  }

  const navActions = [
    {
      id: 'feed',
      label: 'Inicio',
      icon: <Home className="h-6 w-6" strokeWidth={1.5} />,
      activeIcon: <Home className="h-6 w-6" strokeWidth={2.5} />,
      onClick: () => { setActivePanel(null); router.push('/feed'); },
      isActive: pathname === '/feed' && !panelOpen,
    },
    {
      id: 'search',
      label: 'Buscar',
      icon: <Search className="h-6 w-6" strokeWidth={1.5} />,
      activeIcon: <Search className="h-6 w-6" strokeWidth={2.5} />,
      onClick: () => togglePanel('search'),
      isActive: activePanel === 'search',
    },
    {
      id: 'explore',
      label: 'Explorar',
      icon: <Compass className="h-6 w-6" strokeWidth={1.5} />,
      activeIcon: <Compass className="h-6 w-6" strokeWidth={2.5} />,
      onClick: () => { setActivePanel(null); router.push('/explore'); },
      isActive: pathname.startsWith('/explore') && !panelOpen,
    },
    {
      id: 'flashes',
      label: 'Flashes',
      icon: <Zap className="h-6 w-6" strokeWidth={1.5} />,
      activeIcon: <Zap className="h-6 w-6" strokeWidth={2.5} />,
      onClick: () => { setActivePanel(null); router.push('/flashes'); },
      isActive: pathname.startsWith('/flashes') && !panelOpen,
    },
    {
      id: 'create',
      label: 'Crear',
      icon: <PlusSquare className="h-6 w-6" strokeWidth={1.5} />,
      activeIcon: <PlusSquare className="h-6 w-6" strokeWidth={2.5} />,
      onClick: () => { setActivePanel(null); setCreateMenuOpen((p) => !p); },
      isActive: createMenuOpen || showCreatePost || showCreateFlash || showCreateStory || showCreateNote,
    },
    {
      id: 'messages',
      label: 'Mensajes',
      icon: <Send className="h-6 w-6" strokeWidth={1.5} />,
      activeIcon: <Send className="h-6 w-6" strokeWidth={2.5} />,
      onClick: () => { setActivePanel(null); setUnreadMessages(0); router.push('/messages'); },
      isActive: pathname.startsWith('/messages') && !panelOpen,
      badge: unreadMessages,
    },
    {
      id: 'notifications',
      label: 'Notificaciones',
      icon: <Bell className="h-6 w-6" strokeWidth={1.5} />,
      activeIcon: <Bell className="h-6 w-6" strokeWidth={2.5} />,
      onClick: () => togglePanel('notifications'),
      isActive: activePanel === 'notifications',
      badge: unread,
    },
  ];

  const isProfileActive = pathname.includes(`/profile/${user.username}`) && !panelOpen;

  return (
    <>
      {/* ═══════ Desktop Sidebar ═══════ */}
      {/* Collapses to icons-only when a panel is open */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-gray-200 bg-white transition-all duration-300 xl:flex
          ${panelOpen ? 'w-[72px] items-center' : 'w-[220px]'}`}
      >
        {/* Logo */}
        <Link
          href="/feed"
          onClick={() => setActivePanel(null)}
          className={`group flex items-center gap-3 py-7 transition-colors hover:bg-gray-50
            ${panelOpen ? 'justify-center px-0' : 'px-6'}`}
        >
          <MessageCircle className="h-7 w-7 text-primary-600 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-8deg]" />
          {!panelOpen && (
            <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent">
              IChatTime
            </span>
          )}
        </Link>

        {/* Nav */}
        <nav className={`flex flex-1 flex-col gap-1 ${panelOpen ? 'items-center px-2' : 'px-3'}`}>
          {navActions.map((item) => (
            <div key={item.id} className={item.id === 'create' ? 'relative' : ''}>
              {panelOpen
                ? renderNavIcon(item.id, item.label, item.icon, item.activeIcon, item.onClick, item.isActive, item.badge)
                : renderNavButton(item.id, item.label, item.icon, item.activeIcon, item.onClick, item.isActive, item.badge, true)
              }
              {item.id === 'create' && renderCreateSubmenu(panelOpen)}
            </div>
          ))}

          {/* Profile */}
          {panelOpen ? (
            <Link
              href={`/profile/${user.username}`}
              onClick={() => setActivePanel(null)}
              title="Perfil"
              className={`group relative flex items-center justify-center rounded-xl p-3 transition-all duration-200
                ${isProfileActive ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
            >
              <span className="transition-transform duration-200 group-hover:scale-110 group-active:scale-90">
                <div className={`rounded-full ${isProfileActive ? 'ring-2 ring-gray-900' : ''}`}>
                  <Avatar src={user.avatarUrl} alt={user.displayName} size={28} />
                </div>
              </span>
              <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1">
                Perfil
              </span>
            </Link>
          ) : (
            <Link
              href={`/profile/${user.username}`}
              onClick={() => setActivePanel(null)}
              className={`sidebar-link group flex items-center gap-4 rounded-xl px-3 py-3 text-[15px] transition-all duration-200
                ${isProfileActive
                  ? 'bg-gray-100 font-semibold text-gray-900'
                  : 'font-normal text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <span className="transition-transform duration-200 group-hover:scale-110 group-active:scale-90">
                <div className={`rounded-full ${isProfileActive ? 'ring-2 ring-gray-900' : ''}`}>
                  <Avatar src={user.avatarUrl} alt={user.displayName} size={28} />
                </div>
              </span>
              <span className="transition-transform duration-200 group-hover:translate-x-0.5">
                Perfil
              </span>
            </Link>
          )}

        </nav>

        {/* Logout */}
        <div className={`border-t border-gray-200 py-4 ${panelOpen ? 'px-2' : 'px-3'}`}>
          {panelOpen ? (
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="group relative flex w-full items-center justify-center rounded-xl p-3 text-gray-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600"
            >
              <span className="transition-transform duration-200 group-hover:scale-110 group-active:scale-90">
                <LogOut className="h-6 w-6" strokeWidth={1.5} />
              </span>
              <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1">
                Cerrar sesión
              </span>
            </button>
          ) : (
            <button
              onClick={handleLogout}
              className="group flex w-full items-center gap-4 rounded-xl px-3 py-3 text-[15px] text-gray-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600"
            >
              <span className="transition-transform duration-200 group-hover:scale-110 group-active:scale-90">
                <LogOut className="h-6 w-6" strokeWidth={1.5} />
              </span>
              <span className="transition-transform duration-200 group-hover:translate-x-0.5">
                Cerrar sesión
              </span>
            </button>
          )}
        </div>
      </aside>

      {/* ═══════ Tablet Sidebar (always icons-only) ═══════ */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[72px] flex-col items-center border-r border-gray-200 bg-white md:flex xl:hidden">
        <Link
          href="/feed"
          onClick={() => setActivePanel(null)}
          className="group flex items-center justify-center py-7"
        >
          <MessageCircle className="h-7 w-7 text-primary-600 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-8deg]" />
        </Link>

        <nav className="flex flex-1 flex-col items-center gap-1 px-2">
          {navActions.map((item) => (
            <div key={item.id} className={item.id === 'create' ? 'relative' : ''}>
              {renderNavIcon(item.id, item.label, item.icon, item.activeIcon, item.onClick, item.isActive, item.badge)}
              {item.id === 'create' && renderCreateSubmenu(true)}
            </div>
          ))}

          <Link
            href={`/profile/${user.username}`}
            onClick={() => setActivePanel(null)}
            title="Perfil"
            className={`group relative flex items-center justify-center rounded-xl p-3 transition-all duration-200
              ${isProfileActive ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
          >
            <span className="transition-transform duration-200 group-hover:scale-110 group-active:scale-90">
              <div className={`rounded-full ${isProfileActive ? 'ring-2 ring-gray-900' : ''}`}>
                <Avatar src={user.avatarUrl} alt={user.displayName} size={28} />
              </div>
            </span>
            <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1">
              Perfil
            </span>
          </Link>

        </nav>

        <div className="border-t border-gray-200 px-2 py-4">
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="group relative flex items-center justify-center rounded-xl p-3 text-gray-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600"
          >
            <span className="transition-transform duration-200 group-hover:scale-110 group-active:scale-90">
              <LogOut className="h-6 w-6" strokeWidth={1.5} />
            </span>
            <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1">
              Cerrar sesión
            </span>
          </button>
        </div>
      </aside>

      {/* ═══════ Mobile Bottom Bar ═══════ */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-around border-t border-gray-200 bg-white/90 backdrop-blur py-1.5 safe-area-bottom md:hidden">
        {navActions.filter((item) => ['feed', 'flashes', 'search', 'messages'].includes(item.id)).map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={`relative flex flex-col items-center gap-0.5 p-2 transition-all duration-200 active:scale-90
              ${item.isActive ? 'text-gray-900' : 'text-gray-500'}`}
          >
            <span className="relative">
              {item.isActive ? item.activeIcon : item.icon}
              {item.badge && item.badge > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              ) : null}
            </span>
            <span className="text-[10px]">{item.label}</span>
          </button>
        ))}
        <Link
          href={`/profile/${user.username}`}
          className={`flex flex-col items-center gap-0.5 p-2 transition-all duration-200 active:scale-90
            ${isProfileActive ? 'text-gray-900' : 'text-gray-500'}`}
        >
          <div className={`rounded-full ${isProfileActive ? 'ring-2 ring-gray-900' : ''}`}>
            <Avatar src={user.avatarUrl} alt={user.displayName} size={24} />
          </div>
          <span className="text-[10px]">Perfil</span>
        </Link>
      </nav>

      {/* ═══════ Slide-out Panels ═══════ */}
      <SearchPanel open={activePanel === 'search'} onClose={() => setActivePanel(null)} />
      <NotificationsPanel
        open={activePanel === 'notifications'}
        onClose={() => setActivePanel(null)}
        onRead={handleNotifRead}
        onOpenPost={handleOpenPostFromNotification}
      />

      {activePost && (
        <PostDetailModal
          post={activePost}
          open={postModalOpen}
          onClose={() => {
            setPostModalOpen(false);
            setActivePost(null);
          }}
        />
      )}

      {/* ═══════ Create Modals ═══════ */}
      <CreatePostModal
        open={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onCreated={() => {
          if (pathname === '/feed') {
            window.dispatchEvent(new Event('feed:refresh'));
          } else {
            router.push('/feed');
          }
        }}
      />
      <CreateFlashModal
        open={showCreateFlash}
        onClose={() => setShowCreateFlash(false)}
        onCreated={() => {
          router.push('/flashes');
        }}
      />
      <CreateStoryModal
        open={showCreateStory}
        onClose={() => setShowCreateStory(false)}
        onCreated={() => {
          window.dispatchEvent(new Event('stories:refresh'));
        }}
      />
      <CreateNoteModal
        open={showCreateNote}
        onClose={() => setShowCreateNote(false)}
        onCreated={() => {
          if (pathname === '/feed') {
            window.dispatchEvent(new Event('feed:refresh'));
          } else {
            router.push('/feed');
          }
        }}
      />
    </>
  );
}
