'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { UserPlus, UserMinus, Grid3X3, Camera, Heart, MessageCircle, Film, Copy, Send, UserCheck, UserX, Clock, Users, Bookmark, Settings, Zap, Play, FileText, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { User, Post, Flash, FollowStats, FriendStatus } from '@/lib/types';
import Avatar from '@/components/Avatar';
import PostDetailModal from '@/components/PostDetailModal';
import NoteDetailModal from '@/components/NoteDetailModal';
import LoadingLogo from '@/components/LoadingLogo';
import FollowListModal from '@/components/FollowListModal';
import PostCard from '@/components/PostCard';
import { renderHashtags } from '@/lib/renderHashtags';

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const me = useAuthStore((s) => s.user);
  const router = useRouter();
  const [profile, setProfile] = useState<User | null>(null);
  const [stats, setStats] = useState<FollowStats>({ followers: 0, following: 0 });
  const [posts, setPosts] = useState<Post[]>([]);
  const [postCount, setPostCount] = useState(0);
  const [postCursor, setPostCursor] = useState<string | null>(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const fetchingPostsRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>({ status: 'none', requestId: null });
  const [friendBusy, setFriendBusy] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedNote, setSelectedNote] = useState<Post | null>(null);
  const [followModal, setFollowModal] = useState<'followers' | 'following' | null>(null);
  const [activeTab, setActiveTab] = useState<'flashes' | 'posts' | 'notes' | 'favorites'>('flashes');
  const [notes, setNotes] = useState<Post[]>([]);
  const [noteCursor, setNoteCursor] = useState<string | null>(null);
  const [hasMoreNotes, setHasMoreNotes] = useState(true);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const fetchingNotesRef = useRef(false);
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const [flashCursor, setFlashCursor] = useState<string | null>(null);
  const [hasMoreFlashes, setHasMoreFlashes] = useState(true);
  const [loadingFlashes, setLoadingFlashes] = useState(false);
  const fetchingFlashesRef = useRef(false);
  const [favorites, setFavorites] = useState<Post[]>([]);
  const [favCursor, setFavCursor] = useState<string | null>(null);
  const [hasMoreFavs, setHasMoreFavs] = useState(true);
  const [loadingFavs, setLoadingFavs] = useState(false);
  const fetchingFavsRef = useRef(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const setUser = useAuthStore((s) => s.setUser);
  const isMe = me?.username === username;
  const [isMobile, setIsMobile] = useState(false);
  const { ref: gridSentinelRef, inView: gridInView } = useInView();
  const { ref: favSentinelRef, inView: favInView } = useInView();
  const { ref: flashSentinelRef, inView: flashInView } = useInView();
  const { ref: noteSentinelRef, inView: noteInView } = useInView();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error('Máximo 5 MB'); return; }
    try {
      const fd = new FormData();
      fd.append('avatar', f);
      const { data } = await api.patch('/users/me/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setProfile(data);
      setUser(data);
      toast.success('Foto de perfil actualizada');
    } catch {
      toast.error('No se pudo cambiar la foto');
    }
    if (avatarRef.current) avatarRef.current.value = '';
  }

  const profileIdRef = useRef<string | null>(null);

  const fetchProfilePosts = useCallback(async (userId: string, cursor: string | null, reset: boolean) => {
    if (fetchingPostsRef.current) return;
    fetchingPostsRef.current = true;
    setLoadingPosts(true);
    try {
      const params = new URLSearchParams({ limit: '12', withMedia: 'true' });
      if (cursor) params.set('cursor', cursor);
      const { data: p } = await api.get(`/posts/user/${userId}?${params}`);
      const items: Post[] = p.items ?? [];
      if (!p.nextCursor) setHasMorePosts(false);
      setPostCursor(p.nextCursor ?? null);
      setPosts((prev) => (reset ? items : [...prev, ...items]));
    } catch { /* ignore */ }
    setLoadingPosts(false);
    fetchingPostsRef.current = false;
  }, []);

  const fetchFlashes = useCallback(async (userId: string, cursor: string | null, reset: boolean) => {
    if (fetchingFlashesRef.current) return;
    fetchingFlashesRef.current = true;
    setLoadingFlashes(true);
    try {
      const params = new URLSearchParams({ limit: '12' });
      if (cursor) params.set('cursor', cursor);
      const { data: p } = await api.get(`/flashes/user/${userId}?${params}`);
      const items: Flash[] = p.items ?? [];
      if (!p.nextCursor) setHasMoreFlashes(false);
      setFlashCursor(p.nextCursor ?? null);
      setFlashes((prev) => (reset ? items : [...prev, ...items]));
    } catch { /* ignore */ }
    setLoadingFlashes(false);
    fetchingFlashesRef.current = false;
  }, []);

  const fetchNotes = useCallback(async (userId: string, cursor: string | null, reset: boolean) => {
    if (fetchingNotesRef.current) return;
    fetchingNotesRef.current = true;
    setLoadingNotes(true);
    try {
      const params = new URLSearchParams({ limit: '12', textOnly: 'true' });
      if (cursor) params.set('cursor', cursor);
      const { data: p } = await api.get(`/posts/user/${userId}?${params}`);
      const items: Post[] = p.items ?? [];
      if (!p.nextCursor) setHasMoreNotes(false);
      setNoteCursor(p.nextCursor ?? null);
      setNotes((prev) => (reset ? items : [...prev, ...items]));
    } catch { /* ignore */ }
    setLoadingNotes(false);
    fetchingNotesRef.current = false;
  }, []);

  const fetchFavorites = useCallback(async (userId: string, cursor: string | null, reset: boolean) => {
    if (fetchingFavsRef.current) return;
    fetchingFavsRef.current = true;
    setLoadingFavs(true);
    try {
      const params = new URLSearchParams({ limit: '12' });
      if (cursor) params.set('cursor', cursor);
      const { data: p } = await api.get(`/users/${userId}/favorites?${params}`);
      const items: Post[] = p.items ?? [];
      if (!p.nextCursor) setHasMoreFavs(false);
      setFavCursor(p.nextCursor ?? null);
      setFavorites((prev) => (reset ? items : [...prev, ...items]));
    } catch { /* ignore */ }
    setLoadingFavs(false);
    fetchingFavsRef.current = false;
  }, []);

  const load = useCallback(async () => {
    try {
      const { data: u } = await api.get(`/users/${username}`);
      setProfile(u);
      profileIdRef.current = u.id;
      const [{ data: s }, { data: fs }] = await Promise.all([
        api.get(`/users/${u.id}/stats`),
        api.get(`/friend-requests/status/${u.id}`),
      ]);
      setStats(s);
      setPostCount(s.postsCount ?? 0);
      setFriendStatus(fs);
      setPosts([]);
      setPostCursor(null);
      setHasMorePosts(true);
      fetchingPostsRef.current = false;
      await fetchProfilePosts(u.id, null, true);
    } catch {
      toast.error('Usuario no encontrado');
    }
  }, [username, fetchProfilePosts]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (gridInView && hasMorePosts && !loadingPosts && profileIdRef.current && activeTab === 'posts') {
      fetchProfilePosts(profileIdRef.current, postCursor, false);
    }
  }, [gridInView, hasMorePosts, loadingPosts, postCursor, fetchProfilePosts, activeTab]);

  // Fetch flashes when tab switches
  useEffect(() => {
    if (activeTab === 'flashes' && profileIdRef.current && flashes.length === 0) {
      fetchFlashes(profileIdRef.current, null, true);
    }
  }, [activeTab, flashes.length, fetchFlashes]);

  useEffect(() => {
    if (flashInView && hasMoreFlashes && !loadingFlashes && profileIdRef.current && activeTab === 'flashes') {
      fetchFlashes(profileIdRef.current, flashCursor, false);
    }
  }, [flashInView, hasMoreFlashes, loadingFlashes, flashCursor, fetchFlashes, activeTab]);

  // Fetch notes when tab switches
  useEffect(() => {
    if (activeTab === 'notes' && profileIdRef.current && notes.length === 0) {
      fetchNotes(profileIdRef.current, null, true);
    }
  }, [activeTab, notes.length, fetchNotes]);

  useEffect(() => {
    if (noteInView && hasMoreNotes && !loadingNotes && profileIdRef.current && activeTab === 'notes') {
      fetchNotes(profileIdRef.current, noteCursor, false);
    }
  }, [noteInView, hasMoreNotes, loadingNotes, noteCursor, fetchNotes, activeTab]);

  // Fetch favorites when tab switches
  useEffect(() => {
    if (activeTab === 'favorites' && profileIdRef.current && favorites.length === 0) {
      fetchFavorites(profileIdRef.current, null, true);
    }
  }, [activeTab, favorites.length, fetchFavorites]);

  useEffect(() => {
    if (favInView && hasMoreFavs && !loadingFavs && profileIdRef.current && activeTab === 'favorites') {
      fetchFavorites(profileIdRef.current, favCursor, false);
    }
  }, [favInView, hasMoreFavs, loadingFavs, favCursor, fetchFavorites, activeTab]);

  async function toggleFollow() {
    if (!profile || busy) return;
    setBusy(true);
    try {
      if (stats.isFollowing) {
        await api.delete(`/users/${profile.id}/follow`);
        setStats((s) => ({ ...s, isFollowing: false, followers: s.followers - 1 }));
      } else {
        await api.post(`/users/${profile.id}/follow`);
        setStats((s) => ({ ...s, isFollowing: true, followers: s.followers + 1 }));
      }
    } catch {
      toast.error('Acción fallida');
    } finally {
      setBusy(false);
    }
  }

  async function sendFriendRequest() {
    if (!profile || friendBusy) return;
    setFriendBusy(true);
    try {
      await api.post(`/friend-requests/send/${profile.id}`);
      const { data: fs } = await api.get(`/friend-requests/status/${profile.id}`);
      setFriendStatus(fs);
      toast.success('Solicitud enviada');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'No se pudo enviar');
    } finally {
      setFriendBusy(false);
    }
  }

  async function cancelFriendRequest() {
    if (!friendStatus.requestId || friendBusy) return;
    setFriendBusy(true);
    try {
      await api.delete(`/friend-requests/${friendStatus.requestId}/cancel`);
      setFriendStatus({ status: 'none', requestId: null });
      toast.success('Solicitud cancelada');
    } catch {
      toast.error('No se pudo cancelar');
    } finally {
      setFriendBusy(false);
    }
  }

  async function acceptFriendRequest() {
    if (!friendStatus.requestId || friendBusy) return;
    setFriendBusy(true);
    try {
      await api.post(`/friend-requests/${friendStatus.requestId}/accept`);
      setFriendStatus({ status: 'friends', requestId: friendStatus.requestId });
      toast.success('Solicitud aceptada');
    } catch {
      toast.error('No se pudo aceptar');
    } finally {
      setFriendBusy(false);
    }
  }

  async function rejectFriendRequest() {
    if (!friendStatus.requestId || friendBusy) return;
    setFriendBusy(true);
    try {
      await api.post(`/friend-requests/${friendStatus.requestId}/reject`);
      setFriendStatus({ status: 'none', requestId: null });
      toast.success('Solicitud rechazada');
    } catch {
      toast.error('No se pudo rechazar');
    } finally {
      setFriendBusy(false);
    }
  }

  async function unfriend() {
    if (!friendStatus.requestId || friendBusy) return;
    setFriendBusy(true);
    try {
      await api.delete(`/friend-requests/${friendStatus.requestId}/unfriend`);
      setFriendStatus({ status: 'none', requestId: null });
      toast.success('Amistad eliminada');
    } catch {
      toast.error('No se pudo eliminar amistad');
    } finally {
      setFriendBusy(false);
    }
  }

  function handleDelete(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setSelectedPost(null);
  }

  function handlePostUpdate(updated: Post) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, likesCount: updated.likesCount, likedByMe: updated.likedByMe, commentsCount: updated.commentsCount } : p)));
  }

  function getMediaUrl(post: Post) {
    const first = post.mediaUrls?.[0];
    if (!first) return null;
    return first.startsWith('http') ? first : `/uploads/${first}`;
  }

  function isVideoPost(post: Post) {
    return post.mediaUrls?.[0]?.match(/\.(mp4|webm|mov)$/i);
  }

  const selectedRef = useCallback((node: HTMLDivElement | null) => {
    if (node) setTimeout(() => node.scrollIntoView({ behavior: 'auto', block: 'start' }), 50);
  }, []);

  if (!profile) {
    return (
      <div className="flex justify-center py-20">
        <LoadingLogo size="md" text="" />
      </div>
    );
  }

  /* ─── Mobile inline post view ─── */
  if (selectedPost && isMobile) {
    const isFavView = activeTab === 'favorites';
    const sourceList = isFavView ? favorites : posts;

    return (
      <div className="min-h-[calc(100vh-5rem)]">
        {/* Header */}
        <div className="sticky top-0 z-30 flex items-center justify-between bg-white border-b border-gray-100 px-3 py-2.5">
          <button
            onClick={() => setSelectedPost(null)}
            className="rounded-lg p-1.5 text-gray-700 hover:bg-gray-100 transition active:scale-90"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-sm font-bold text-gray-900 truncate mx-2">
            {isFavView ? 'Favoritos' : 'Publicaciones'} de {profile.displayName}
          </h2>
          {!isMe ? (
            <button
              onClick={toggleFollow}
              disabled={busy}
              className={`${stats.isFollowing ? 'btn-secondary' : 'btn-primary'} gap-1 text-xs px-3 py-1.5`}
            >
              {stats.isFollowing ? 'Siguiendo' : 'Seguir'}
            </button>
          ) : (
            <div className="w-16" />
          )}
        </div>
        {/* All posts — newer above, selected scrolled-to, older below */}
        <div className="pb-20 space-y-4">
          {sourceList.map((p) => (
            <div key={p.id} ref={p.id === selectedPost.id ? selectedRef : undefined}>
              <PostCard post={p} onDelete={isMe ? handleDelete : undefined} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 min-h-[calc(100vh-5rem)]">
      {/* Profile header */}
      <div className="card px-4 py-4 sm:px-6 sm:py-5">
        {/* Row 1: Avatar + Name + Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative group shrink-0">
            <Avatar src={profile.avatarUrl} alt={profile.displayName} size={72} />
            {isMe && (
              <>
                <button
                  type="button"
                  onClick={() => avatarRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition group-hover:opacity-100"
                >
                  <Camera className="h-5 w-5 text-white" />
                </button>
                <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold leading-tight truncate">{profile.displayName}</h1>
            <p className="text-sm text-gray-500 truncate">@{profile.username}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isMe && (
              <button
                onClick={() => router.push('/settings')}
                className="btn-secondary gap-1.5 text-xs px-3 py-1.5"
              >
                <Settings className="h-3.5 w-3.5" /> Editar
              </button>
            )}
            {!isMe && (
              <>
                <button onClick={toggleFollow} disabled={busy} className={`${stats.isFollowing ? 'btn-secondary' : 'btn-primary'} gap-1.5 text-xs px-3 py-1.5`}>
                  {stats.isFollowing ? <><UserMinus className="h-3.5 w-3.5" /> Siguiendo</> : <><UserPlus className="h-3.5 w-3.5" /> Seguir</>}
                </button>
                <button
                  onClick={() => router.push(`/messages/${profile.id}`)}
                  className="btn-secondary gap-1.5 text-xs px-3 py-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Bio */}
        {profile.bio && <p className="mt-2 text-sm text-gray-700 leading-snug">{profile.bio}</p>}

        {/* Stats row */}
        <div className="mt-3 flex items-center gap-5">
          <span className="text-sm text-gray-600"><strong className="text-gray-900">{postCount}</strong> publicaciones</span>
          <button onClick={() => setFollowModal('followers')} className="text-sm text-gray-600 hover:text-gray-900 transition"><strong className="text-gray-900">{stats.followers}</strong> seguidores</button>
          <button onClick={() => setFollowModal('following')} className="text-sm text-gray-600 hover:text-gray-900 transition"><strong className="text-gray-900">{stats.following}</strong> siguiendo</button>
        </div>

        {/* Friend request row (only for other users) */}
        {!isMe && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {friendStatus.status === 'none' && (
              <button onClick={sendFriendRequest} disabled={friendBusy} className="btn-primary gap-1.5 text-xs px-3 py-1.5">
                <Users className="h-3.5 w-3.5" /> Solicitud de amistad
              </button>
            )}
            {friendStatus.status === 'sent' && (
              <button onClick={cancelFriendRequest} disabled={friendBusy} className="btn-secondary gap-1.5 text-xs px-3 py-1.5 text-amber-600 border-amber-300">
                <Clock className="h-3.5 w-3.5" /> Solicitud enviada
              </button>
            )}
            {friendStatus.status === 'received' && (
              <>
                <button onClick={acceptFriendRequest} disabled={friendBusy} className="btn-primary gap-1.5 text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700">
                  <UserCheck className="h-3.5 w-3.5" /> Aceptar
                </button>
                <button onClick={rejectFriendRequest} disabled={friendBusy} className="btn-secondary gap-1.5 text-xs px-3 py-1.5 text-red-600 border-red-300 hover:bg-red-50">
                  <UserX className="h-3.5 w-3.5" /> Rechazar
                </button>
              </>
            )}
            {friendStatus.status === 'friends' && (
              <button onClick={unfriend} disabled={friendBusy} className="btn-secondary gap-1.5 text-xs px-3 py-1.5 text-green-600 border-green-300">
                <UserCheck className="h-3.5 w-3.5" /> Amigos
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div>
        <div className="flex items-center justify-center gap-8 sm:gap-12 border-t border-gray-200 pt-1">
          <button
            onClick={() => setActiveTab('flashes')}
            className={`flex items-center gap-2 py-3 text-xs font-semibold uppercase tracking-[.2em] border-t-2 -mt-[1px] transition ${
              activeTab === 'flashes' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Zap className="h-4 w-4" /> <span className="hidden sm:inline">Flash</span>
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex items-center gap-2 py-3 text-xs font-semibold uppercase tracking-[.2em] border-t-2 -mt-[1px] transition ${
              activeTab === 'posts' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <Grid3X3 className="h-4 w-4" /> <span className="hidden sm:inline">Publicaciones</span>
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex items-center gap-2 py-3 text-xs font-semibold uppercase tracking-[.2em] border-t-2 -mt-[1px] transition ${
              activeTab === 'notes' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <FileText className="h-4 w-4" /> <span className="hidden sm:inline">Notas</span>
          </button>
          {isMe && (
            <button
              onClick={() => setActiveTab('favorites')}
              className={`flex items-center gap-2 py-3 text-xs font-semibold uppercase tracking-[.2em] border-t-2 -mt-[1px] transition ${
                activeTab === 'favorites' ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <Bookmark className="h-4 w-4" /> <span className="hidden sm:inline">Favoritos</span>
            </button>
          )}
        </div>

        {/* Flashes grid */}
        {activeTab === 'flashes' && (
          <>
            {flashes.length === 0 && !loadingFlashes ? (
              <p className="py-12 text-center text-gray-400">Aún no hay flashes</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-1.5 mt-4">
                {flashes.map((flash) => (
                  <button
                    key={flash.id}
                    onClick={() => router.push(`/flashes?id=${flash.id}`)}
                    className="group relative aspect-[9/16] overflow-hidden rounded-lg bg-black"
                  >
                    <video
                      src={flash.videoUrl}
                      muted
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                    {/* Play icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="rounded-full bg-black/30 p-2 opacity-0 group-hover:opacity-100 transition">
                        <Play className="h-6 w-6 text-white fill-white" />
                      </div>
                    </div>
                    {/* Bottom overlay */}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2.5">
                      <div className="flex items-center gap-3 text-xs text-white">
                        <span className="flex items-center gap-1">
                          <Heart className="h-3.5 w-3.5 fill-white" />{flash.likesCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3.5 w-3.5 fill-white" />{flash.commentsCount}
                        </span>
                      </div>
                      {flash.description && (
                        <p className="mt-1 text-[10px] text-white/80 line-clamp-1">{flash.description}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {hasMoreFlashes && (
              <div ref={flashSentinelRef} className="flex justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
              </div>
            )}
          </>
        )}

        {/* Posts grid */}
        {activeTab === 'posts' && (
          <>
        {posts.length === 0 ? (
          <p className="py-12 text-center text-gray-400">Aún no hay publicaciones</p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-1.5 mt-4">
            {posts.map((post) => {
              const mediaUrl = getMediaUrl(post);
              const isVideo = isVideoPost(post);
              return (
                <button
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className="group relative aspect-square overflow-hidden rounded-sm bg-gray-100"
                >
                  {mediaUrl ? (
                    isVideo ? (
                      <>
                        <video
                          src={mediaUrl}
                          muted
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute right-2 top-2 text-white drop-shadow-lg">
                          <Film className="h-5 w-5" />
                        </div>
                      </>
                    ) : (
                      <>
                        {post.mediaUrls?.length > 1 && (
                          <div className="absolute right-2 top-2 text-white drop-shadow-lg z-10">
                            <Copy className="h-4 w-4" />
                          </div>
                        )}
                        <Image
                          src={mediaUrl}
                          alt=""
                          fill
                          className="object-cover transition-transform duration-200 group-hover:scale-105"
                          sizes="(max-width: 768px) 33vw, 230px"
                        />
                      </>
                    )
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gray-50 p-3">
                      <p className="line-clamp-4 text-xs text-gray-500 text-center">{post.content}</p>
                    </div>
                  )}

                  {/* Hover overlay with likes/comments */}
                  <div className="absolute inset-0 flex items-center justify-center gap-5 bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                      <Heart className="h-5 w-5 fill-white" />
                      {post.likesCount}
                    </span>
                    <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                      <MessageCircle className="h-5 w-5 fill-white" />
                      {post.commentsCount}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {hasMorePosts && (
          <div ref={gridSentinelRef} className="flex justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
          </div>
        )}
          </>
        )}

        {/* Notes grid */}
        {activeTab === 'notes' && (
          <>
            {notes.length === 0 && !loadingNotes ? (
              <p className="py-12 text-center text-gray-400">Aún no hay notas</p>
            ) : (
              <div className="space-y-3 mt-4">
                {notes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    className="w-full text-left card p-4 hover:bg-gray-50 transition group"
                  >
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                      {renderHashtags(note.content)}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Heart className="h-3.5 w-3.5" />{note.likesCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3.5 w-3.5" />{note.commentsCount}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {hasMoreNotes && (
              <div ref={noteSentinelRef} className="flex justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
              </div>
            )}
          </>
        )}

        {/* Favorites grid */}
        {activeTab === 'favorites' && isMe && (
          <>
            {favorites.length === 0 && !loadingFavs ? (
              <p className="py-12 text-center text-gray-400">No tienes publicaciones guardadas</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-1.5 mt-4">
                {favorites.map((fpost) => {
                  const fMediaUrl = getMediaUrl(fpost);
                  const fIsVideo = isVideoPost(fpost);
                  return (
                    <button
                      key={fpost.id}
                      onClick={() => setSelectedPost(fpost)}
                      className="group relative aspect-square overflow-hidden rounded-sm bg-gray-100"
                    >
                      {fMediaUrl ? (
                        fIsVideo ? (
                          <>
                            <video src={fMediaUrl} muted preload="metadata" className="h-full w-full object-cover" />
                            <div className="absolute right-2 top-2 text-white drop-shadow-lg"><Film className="h-5 w-5" /></div>
                          </>
                        ) : (
                          <>
                            {fpost.mediaUrls?.length > 1 && (
                              <div className="absolute right-2 top-2 text-white drop-shadow-lg z-10"><Copy className="h-4 w-4" /></div>
                            )}
                            <Image src={fMediaUrl} alt="" fill className="object-cover transition-transform duration-200 group-hover:scale-105" sizes="(max-width: 768px) 33vw, 230px" />
                          </>
                        )
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gray-50 p-3">
                          <p className="line-clamp-4 text-xs text-gray-500 text-center">{fpost.content}</p>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center gap-5 bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <span className="flex items-center gap-1.5 text-sm font-bold text-white"><Heart className="h-5 w-5 fill-white" />{fpost.likesCount}</span>
                        <span className="flex items-center gap-1.5 text-sm font-bold text-white"><MessageCircle className="h-5 w-5 fill-white" />{fpost.commentsCount}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {hasMoreFavs && (
              <div ref={favSentinelRef} className="flex justify-center py-6">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Post detail modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          open={!!selectedPost}
          onClose={() => setSelectedPost(null)}
          onPostUpdate={handlePostUpdate}
          onDelete={isMe ? handleDelete : undefined}
        />
      )}

      {/* Follow list modal */}
      {followModal && profile && (
        <FollowListModal
          open={!!followModal}
          onClose={() => setFollowModal(null)}
          userId={profile.id}
          type={followModal}
        />
      )}

      {/* Note detail modal */}
      {selectedNote && (
        <NoteDetailModal
          post={selectedNote}
          open={!!selectedNote}
          onClose={() => setSelectedNote(null)}
          onPostUpdate={(updated) => {
            setNotes((prev) => prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)));
            setSelectedNote((prev) => prev ? { ...prev, ...updated } : prev);
          }}
          onDelete={isMe ? (id) => {
            setNotes((prev) => prev.filter((n) => n.id !== id));
            setSelectedNote(null);
          } : undefined}
        />
      )}
    </div>
  );
}
