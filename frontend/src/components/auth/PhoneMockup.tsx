'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Camera, Image as ImageIcon } from 'lucide-react';

/* ── Timing constants ────────────────────────────────────────── */
const FEED_DURATION = 7000;   // ms showing the scrolling feed
const TRANSITION_MS = 800;    // slide-up transition time
const CHAT_BASE_DELAY = 0.5;  // seconds before first chat bubble

/* ── Fake data for the scrolling feed ────────────────────────── */
const fakePosts = [
  {
    user: 'maria_garcia',
    avatar: 'MG',
    avatarColor: 'bg-pink-400',
    imageGradient: 'from-orange-400 via-pink-500 to-purple-600',
    caption: 'Atardecer increíble hoy 🌅',
    likes: 2847,
    time: '2h',
  },
  {
    user: 'carlos_dev',
    avatar: 'CD',
    avatarColor: 'bg-blue-400',
    imageGradient: 'from-cyan-400 via-blue-500 to-indigo-600',
    caption: 'Nuevo proyecto terminado 🚀',
    likes: 1253,
    time: '4h',
  },
  {
    user: 'ana_photo',
    avatar: 'AP',
    avatarColor: 'bg-emerald-400',
    imageGradient: 'from-emerald-400 via-teal-500 to-cyan-600',
    caption: 'Naturaleza pura 🌿✨',
    likes: 4102,
    time: '6h',
  },
  {
    user: 'luis_music',
    avatar: 'LM',
    avatarColor: 'bg-violet-400',
    imageGradient: 'from-violet-400 via-purple-500 to-fuchsia-600',
    caption: 'Sesión en el estudio 🎵',
    likes: 987,
    time: '8h',
  },
  {
    user: 'sofia_travel',
    avatar: 'ST',
    avatarColor: 'bg-amber-400',
    imageGradient: 'from-amber-400 via-orange-500 to-red-500',
    caption: 'Explorando nuevos lugares 🗺️',
    likes: 3561,
    time: '10h',
  },
];

const chatMessages = [
  { from: 'left', text: 'Hey! Viste mi último post? 😄', delay: CHAT_BASE_DELAY },
  { from: 'right', text: 'Sí! Está increíble 🔥', delay: CHAT_BASE_DELAY + 1.0 },
  { from: 'left', text: 'Gracias!! Lo tomé ayer', delay: CHAT_BASE_DELAY + 2.0 },
  { from: 'right', text: 'Tienes que enseñarme 📸', delay: CHAT_BASE_DELAY + 3.0 },
  { from: 'left', text: 'Cuando quieras! 💪', delay: CHAT_BASE_DELAY + 4.0 },
];

/* ── Notification toast mini-component ───────────────────────── */
function NotificationToast() {
  return (
    <motion.div
      className="absolute -right-4 top-8 z-30 flex items-center gap-2.5 rounded-2xl bg-white/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-sm"
      initial={{ opacity: 0, x: 40, scale: 0.8 }}
      animate={{ opacity: [0, 1, 1, 0], x: [40, 0, 0, -10], scale: [0.8, 1, 1, 0.9] }}
      transition={{ duration: 4, repeat: Infinity, repeatDelay: 10, times: [0, 0.1, 0.85, 1] }}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-pink-500 shadow-md shadow-red-200/50">
        <Heart className="h-3.5 w-3.5 fill-white text-white" />
      </div>
      <div className="whitespace-nowrap">
        <p className="text-[10px] font-bold text-gray-800">maria_garcia</p>
        <p className="text-[9px] text-gray-500">le gustó tu post</p>
      </div>
    </motion.div>
  );
}

/* ── Single fake post card ───────────────────────────────────── */
function FakePost({ post }: { post: (typeof fakePosts)[number] }) {
  return (
    <div className="mb-3 flex-shrink-0">
      {/* header */}
      <div className="flex items-center justify-between px-2.5 py-1.5">
        <div className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-bold text-white ${post.avatarColor}`}>
            {post.avatar}
          </div>
          <span className="text-[10px] font-semibold text-gray-900">{post.user}</span>
        </div>
        <MoreHorizontal className="h-3 w-3 text-gray-400" />
      </div>
      {/* image */}
      <div className={`h-36 w-full bg-gradient-to-br ${post.imageGradient} flex items-center justify-center`}>
        <Camera className="h-8 w-8 text-white/30" />
      </div>
      {/* actions */}
      <div className="flex items-center justify-between px-2.5 pt-2">
        <div className="flex items-center gap-3">
          <Heart className="h-4 w-4 text-gray-800" />
          <MessageCircle className="h-4 w-4 text-gray-800" />
          <Send className="h-4 w-4 text-gray-800" />
        </div>
        <Bookmark className="h-4 w-4 text-gray-800" />
      </div>
      <p className="px-2.5 pt-1 text-[10px] font-semibold text-gray-900">{post.likes.toLocaleString()} me gusta</p>
      <p className="px-2.5 pb-2 text-[10px] text-gray-700">
        <span className="font-semibold">{post.user}</span> {post.caption}
      </p>
    </div>
  );
}

/* ── Chat view (full-screen inside phone) ────────────────────── */
function ChatView() {
  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Chat header */}
      <div className="flex items-center gap-2.5 border-b border-gray-200 bg-white px-3 py-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-pink-400 text-[8px] font-bold text-white">
          MG
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-semibold text-gray-800">maria_garcia</span>
          <span className="text-[8px] text-green-500">en línea</span>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden px-3 pb-2 pt-3">
        {chatMessages.map((msg, i) => (
          <motion.div
            key={i}
            className={`max-w-[78%] rounded-2xl px-3 py-2 text-[9px] leading-relaxed ${
              msg.from === 'right'
                ? 'ml-auto bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-br-sm shadow-sm shadow-primary-300/30'
                : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'
            }`}
            initial={{ opacity: 0, y: 14, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: msg.delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {msg.text}
          </motion.div>
        ))}
      </div>

      {/* Typing indicator */}
      <motion.div
        className="flex items-center gap-1.5 border-t border-gray-200 bg-white px-3 py-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: CHAT_BASE_DELAY + 5 }}
      >
        <div className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-gray-400"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
        <span className="text-[8px] text-gray-400">escribiendo...</span>
      </motion.div>
    </div>
  );
}

/* ── Main phone component ────────────────────────────────────── */
export default function PhoneMockup() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<'feed' | 'chat'>('feed');

  /* Auto-scroll feed */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let frame: number;
    let pos = 0;
    const speed = 0.5;

    function scroll() {
      pos += speed;
      if (pos >= el!.scrollHeight - el!.clientHeight) pos = 0;
      el!.scrollTop = pos;
      frame = requestAnimationFrame(scroll);
    }

    const startTimer = setTimeout(() => {
      frame = requestAnimationFrame(scroll);
    }, 400);

    return () => {
      clearTimeout(startTimer);
      cancelAnimationFrame(frame);
    };
  }, []);

  /* Phase transition: feed → chat → feed (loop) */
  useEffect(() => {
    const CHAT_DISPLAY = 10000; // how long chat stays visible

    const feedTimer = setTimeout(() => setPhase('chat'), FEED_DURATION);
    const chatTimer = setTimeout(() => setPhase('feed'), FEED_DURATION + CHAT_DISPLAY);

    // Full loop
    const interval = setInterval(() => {
      setPhase('feed');
      setTimeout(() => setPhase('chat'), FEED_DURATION);
    }, FEED_DURATION + CHAT_DISPLAY);

    return () => {
      clearTimeout(feedTimer);
      clearTimeout(chatTimer);
      clearInterval(interval);
    };
  }, []);

  const CONTENT_HEIGHT = 348; // total inner content area (420 - statusbar ~42 - bottom bar ~10)

  return (
    <motion.div
      className="relative"
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <NotificationToast />

      {/* Phone frame */}
      <div className="relative mx-auto h-[440px] w-[220px] overflow-hidden rounded-[32px] border-[3px] border-white/20 bg-black shadow-2xl shadow-black/40">
        {/* Dynamic Island notch */}
        <div className="absolute left-1/2 top-1.5 z-20 h-[18px] w-[70px] -translate-x-1/2 rounded-full bg-black" />

        {/* Status bar */}
        <div className="relative z-10 flex items-center justify-between bg-white px-3 pt-7 pb-1.5">
          <span className="text-[8px] font-semibold text-gray-800">9:41</span>
          <span className="text-[10px] font-bold tracking-tight text-gray-900">IChatTime</span>
          <div className="flex items-center gap-1">
            <ImageIcon className="h-3 w-3 text-gray-500" />
            <Send className="h-3 w-3 text-gray-500" />
          </div>
        </div>

        {/* Content area: feed or chat */}
        <div className="relative" style={{ height: CONTENT_HEIGHT }}>
          <AnimatePresence mode="wait">
            {phase === 'feed' ? (
              <motion.div
                key="feed"
                className="absolute inset-0 overflow-hidden bg-white"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: TRANSITION_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
              >
                <div
                  ref={scrollRef}
                  className="h-full overflow-hidden bg-white"
                  style={{ scrollbarWidth: 'none' }}
                >
                  {[...fakePosts, ...fakePosts, ...fakePosts].map((post, i) => (
                    <FakePost key={i} post={post} />
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="chat"
                className="absolute inset-0"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: TRANSITION_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
              >
                <ChatView />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom bar */}
        <div className="absolute bottom-1.5 left-1/2 z-10 h-1 w-24 -translate-x-1/2 rounded-full bg-gray-700" />
      </div>

      {/* Glow effect behind phone */}
      <div className="absolute inset-0 -z-10 mx-auto h-[440px] w-[220px] rounded-[32px] bg-white/10 blur-2xl" />
    </motion.div>
  );
}
