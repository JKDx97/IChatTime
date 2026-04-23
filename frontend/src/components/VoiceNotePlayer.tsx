'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Mic } from 'lucide-react';

const BAR_COUNT = 40;

interface Props {
  src: string;
  isMine?: boolean;
  compact?: boolean;
}

export default function VoiceNotePlayer({ src, isMine = false, compact = false }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(BAR_COUNT).fill(0.15));

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause(); else a.play();
  }, [playing]);

  // Decode audio data to generate waveform bars
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(src);
        const arrBuf = await res.arrayBuffer();
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const decoded = await ctx.decodeAudioData(arrBuf);
        const raw = decoded.getChannelData(0);
        const samplesPerBar = Math.floor(raw.length / BAR_COUNT);
        const result: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0;
          const start = i * samplesPerBar;
          for (let j = start; j < start + samplesPerBar && j < raw.length; j++) {
            sum += Math.abs(raw[j]);
          }
          result.push(sum / samplesPerBar);
        }
        // Normalize to 0..1
        const max = Math.max(...result, 0.01);
        const normalized = result.map((v) => Math.max(0.08, v / max));
        if (!cancelled) setBars(normalized);
        ctx.close();
      } catch {
        // If decode fails, use random pattern
        if (!cancelled) {
          setBars(Array.from({ length: BAR_COUNT }, () => 0.1 + Math.random() * 0.5));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [src]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onLoaded = () => setDuration(a.duration || 0);
    const onTime = () => setCurrent(a.currentTime);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => { setPlaying(false); setCurrent(0); };
    a.addEventListener('loadedmetadata', onLoaded);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnded);
    return () => {
      a.removeEventListener('loadedmetadata', onLoaded);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnded);
    };
  }, []);

  const pct = duration > 0 ? current / duration : 0;

  function fmt(s: number) {
    if (!isFinite(s) || s <= 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    a.currentTime = ratio * duration;
  }

  const barH = compact ? 20 : 28;
  const btnSize = compact ? 'h-7 w-7' : 'h-9 w-9';
  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const activeColor = isMine ? 'rgba(255,255,255,0.9)' : '#3b82f6';
  const inactiveColor = isMine ? 'rgba(255,255,255,0.3)' : '#d1d5db';

  return (
    <div className={`flex items-center gap-2 ${compact ? 'min-w-[180px]' : 'min-w-[220px]'}`}>
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause button */}
      <button
        onClick={toggle}
        className={`shrink-0 rounded-full flex items-center justify-center ${btnSize} ${
          isMine
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-blue-100 hover:bg-blue-200 text-blue-600'
        } transition active:scale-90`}
      >
        {playing ? <Pause className={iconSize} /> : <Play className={`${iconSize} ml-0.5`} />}
      </button>

      {/* Waveform bars */}
      <div className="flex-1 flex flex-col gap-1">
        <div
          className="flex items-center gap-[1.5px] cursor-pointer"
          style={{ height: barH }}
          onClick={handleSeek}
        >
          {bars.map((val, i) => {
            const barPct = (i + 0.5) / BAR_COUNT;
            const isActive = barPct <= pct;
            const h = Math.max(3, val * barH);
            return (
              <div
                key={i}
                className="rounded-full transition-colors duration-150"
                style={{
                  width: compact ? 2 : 2.5,
                  height: h,
                  backgroundColor: isActive ? activeColor : inactiveColor,
                  flexShrink: 0,
                }}
              />
            );
          })}
        </div>

        {/* Duration */}
        <div className="flex items-center gap-1.5">
          <Mic className={`h-2.5 w-2.5 ${isMine ? 'text-white/40' : 'text-gray-400'}`} />
          <span className={`text-[9px] tabular-nums ${isMine ? 'text-white/50' : 'text-gray-400'}`}>
            {playing ? fmt(current) : fmt(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
