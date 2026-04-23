'use client';

import { useState, useRef, useEffect, FormEvent, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, Scissors, Upload, Loader2, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const MAX_DURATION = 90;

export default function CreateFlashModal({ open, onClose, onCreated }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(MAX_DURATION);
  const [needsTrim, setNeedsTrim] = useState(false);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) handleClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, busy]);

  // Handle drag on timeline
  useEffect(() => {
    if (!dragging || !timelineRef.current || duration <= 0) return;

    function handleMove(e: MouseEvent | TouchEvent) {
      const rect = timelineRef.current!.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const time = pct * duration;

      if (dragging === 'start') {
        const newStart = Math.max(0, Math.min(time, trimEnd - 1));
        setTrimStart(newStart);
        if (trimEnd - newStart > MAX_DURATION) {
          setTrimEnd(newStart + MAX_DURATION);
        }
        if (videoRef.current) videoRef.current.currentTime = newStart;
      } else {
        const newEnd = Math.min(duration, Math.max(time, trimStart + 1));
        setTrimEnd(newEnd > trimStart + MAX_DURATION ? trimStart + MAX_DURATION : newEnd);
        if (videoRef.current) videoRef.current.currentTime = Math.min(newEnd, duration);
      }
    }

    function handleUp() { setDragging(null); }

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [dragging, duration, trimStart, trimEnd]);

  function reset() {
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    setFile(null);
    setVideoSrc(null);
    setDuration(0);
    setTrimStart(0);
    setTrimEnd(MAX_DURATION);
    setNeedsTrim(false);
    setDescription('');
    setPlaying(false);
    setCurrentTime(0);
    setUploadProgress(0);
    setDragging(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleClose() {
    if (!busy) { reset(); onClose(); }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('video/')) {
      toast.error('Solo se permiten videos');
      return;
    }
    if (f.size > 100 * 1024 * 1024) {
      toast.error('Máximo 100 MB');
      return;
    }
    const url = URL.createObjectURL(f);
    setFile(f);
    setVideoSrc(url);
  }

  function handleMetadata() {
    const v = videoRef.current;
    if (!v) return;
    const d = v.duration;
    setDuration(d);
    if (d > MAX_DURATION) {
      setNeedsTrim(true);
      setTrimStart(0);
      setTrimEnd(MAX_DURATION);
      toast('El video supera 1:30. Ajusta el recorte.', { icon: '✂️' });
    } else {
      setNeedsTrim(false);
      setTrimStart(0);
      setTrimEnd(d);
    }
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
    } else {
      v.currentTime = trimStart;
      v.play();
    }
    setPlaying(!playing);
  }

  function handleTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.currentTime >= trimEnd) {
      v.pause();
      v.currentTime = trimStart;
      setPlaying(false);
    }
  }

  function seekTo(time: number) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(trimStart, Math.min(trimEnd, time));
    setCurrentTime(v.currentTime);
  }

  // Click on timeline to seek
  function handleTimelineClick(e: React.MouseEvent) {
    if (dragging) return;
    const rect = timelineRef.current!.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const time = pct * duration;
    seekTo(time);
  }

  const trimVideo = useCallback(async (): Promise<File> => {
    if (!file || !videoRef.current) throw new Error('No video');

    const v = videoRef.current;
    const trimDuration = trimEnd - trimStart;

    if (!needsTrim || (trimStart === 0 && trimEnd >= duration)) {
      return file;
    }

    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current!;
      canvas.width = v.videoWidth || 720;
      canvas.height = v.videoHeight || 1280;
      const ctx = canvas.getContext('2d')!;

      const stream = canvas.captureStream(30);

      try {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaElementSource(v);
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(dest);
        source.connect(audioCtx.destination);
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      } catch {
        // No audio track or already connected
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm',
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const trimmed = new File([blob], 'flash.webm', { type: 'video/webm' });
        resolve(trimmed);
      };

      v.currentTime = trimStart;
      v.muted = true;

      const draw = () => {
        if (v.currentTime >= trimEnd || v.paused) {
          recorder.stop();
          v.pause();
          return;
        }
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(draw);
      };

      v.oncanplay = () => {
        recorder.start();
        v.play();
        draw();
        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
            v.pause();
          }
        }, (trimDuration + 1) * 1000);
      };

      setTimeout(() => reject(new Error('Timeout')), (trimDuration + 10) * 1000);
    });
  }, [file, trimStart, trimEnd, needsTrim, duration]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file || busy) return;

    setBusy(true);
    setUploadProgress(0);

    try {
      let uploadFile = file;

      if (needsTrim) {
        toast.loading('Recortando video...', { id: 'trim' });
        try {
          uploadFile = await trimVideo();
          toast.dismiss('trim');
        } catch {
          toast.dismiss('trim');
          toast('No se pudo recortar, subiendo original', { icon: '⚠️' });
        }
      }

      const fd = new FormData();
      fd.append('video', uploadFile);
      fd.append('description', description);

      const { data: created } = await api.post('/flashes', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded * 100) / e.total));
        },
      });

      toast.success('¡Flash publicado!');
      reset();
      onClose();
      onCreated?.();
      router.push(`/flashes?id=${created.id}`);
    } catch {
      toast.error('No se pudo publicar el flash');
    } finally {
      setBusy(false);
      setUploadProgress(0);
    }
  }

  if (!open) return null;

  const clipDuration = trimEnd - trimStart;
  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const startPct = duration > 0 ? (trimStart / duration) * 100 : 0;
  const endPct = duration > 0 ? (trimEnd / duration) * 100 : 100;
  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-md animate-modal-enter max-h-[90vh] flex flex-col">
        <div className="rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-full">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 shrink-0">
            <button onClick={handleClose} disabled={busy} className="text-sm font-medium text-gray-500 hover:text-gray-700 transition">
              Cancelar
            </button>
            <h2 className="text-base font-bold text-gray-900">Nuevo Flash ⚡</h2>
            <button
              onClick={(e) => handleSubmit(e as any)}
              disabled={busy || !file}
              className="text-sm font-bold text-primary-600 transition hover:text-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? 'Subiendo…' : 'Publicar'}
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1">
            <form onSubmit={handleSubmit}>
              {!videoSrc ? (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="mx-5 my-4 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 py-16 cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition"
                >
                  <Upload className="h-10 w-10 text-gray-400" />
                  <p className="text-sm font-medium text-gray-500">Seleccionar video</p>
                  <p className="text-xs text-gray-400">MP4, WebM, MOV · Máx 1:30</p>
                </div>
              ) : (
                <div className="px-5 pt-4 pb-2">
                  {/* Video player */}
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] max-h-[280px] mx-auto">
                    <video
                      ref={videoRef}
                      src={videoSrc}
                      onLoadedMetadata={handleMetadata}
                      onTimeUpdate={handleTimeUpdate}
                      onEnded={() => setPlaying(false)}
                      playsInline
                      className="h-full w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 hover:opacity-100 transition"
                    >
                      {playing ? (
                        <Pause className="h-10 w-10 text-white drop-shadow-lg" />
                      ) : (
                        <Play className="h-10 w-10 text-white drop-shadow-lg" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (videoSrc) URL.revokeObjectURL(videoSrc); setFile(null); setVideoSrc(null); setNeedsTrim(false); setDuration(0); }}
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    {/* Playback time overlay */}
                    {duration > 0 && (
                      <div className="absolute left-2 bottom-2 rounded-md bg-black/60 px-2 py-0.5">
                        <span className="text-[11px] font-mono text-white">{fmt(currentTime)} / {fmt(needsTrim ? clipDuration : duration)}</span>
                      </div>
                    )}
                  </div>

                  {/* Playback controls */}
                  <div className="flex items-center justify-center gap-4 mt-2">
                    <button type="button" onClick={() => seekTo(trimStart)} className="p-1.5 rounded-full hover:bg-gray-100 transition text-gray-500">
                      <SkipBack className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={togglePlay} className="p-2 rounded-full bg-primary-600 text-white hover:bg-primary-700 transition active:scale-95">
                      {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button type="button" onClick={() => seekTo(trimEnd)} className="p-1.5 rounded-full hover:bg-gray-100 transition text-gray-500">
                      <SkipForward className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Visual Timeline Trim Tool */}
                  {needsTrim && (
                    <div className="mt-3 rounded-xl bg-gray-50 border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Scissors className="h-4 w-4 text-primary-600" />
                        <span className="text-xs font-bold text-gray-700">
                          Recortar — {fmt(clipDuration)} seleccionados
                        </span>
                        <span className="ml-auto text-[10px] text-gray-400">máx {MAX_DURATION}s</span>
                      </div>

                      {/* Timeline bar */}
                      <div
                        ref={timelineRef}
                        className="relative h-12 rounded-lg bg-gray-200 cursor-pointer select-none overflow-hidden"
                        onClick={handleTimelineClick}
                      >
                        {/* Dimmed zones (outside selection) */}
                        <div
                          className="absolute inset-y-0 left-0 bg-black/30 rounded-l-lg pointer-events-none"
                          style={{ width: `${startPct}%` }}
                        />
                        <div
                          className="absolute inset-y-0 right-0 bg-black/30 rounded-r-lg pointer-events-none"
                          style={{ width: `${100 - endPct}%` }}
                        />

                        {/* Selected range highlight */}
                        <div
                          className="absolute inset-y-0 bg-primary-100 border-y-2 border-primary-500 pointer-events-none"
                          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
                        />

                        {/* Playhead */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-20"
                          style={{ left: `${playheadPct}%` }}
                        >
                          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500" />
                        </div>

                        {/* Start handle */}
                        <div
                          className="absolute top-0 bottom-0 w-4 cursor-ew-resize z-30 group flex items-center justify-center"
                          style={{ left: `calc(${startPct}% - 8px)` }}
                          onMouseDown={(e) => { e.stopPropagation(); setDragging('start'); }}
                          onTouchStart={(e) => { e.stopPropagation(); setDragging('start'); }}
                        >
                          <div className="w-1 h-8 rounded-full bg-primary-600 group-hover:bg-primary-700 group-hover:w-1.5 transition-all shadow" />
                        </div>

                        {/* End handle */}
                        <div
                          className="absolute top-0 bottom-0 w-4 cursor-ew-resize z-30 group flex items-center justify-center"
                          style={{ left: `calc(${endPct}% - 8px)` }}
                          onMouseDown={(e) => { e.stopPropagation(); setDragging('end'); }}
                          onTouchStart={(e) => { e.stopPropagation(); setDragging('end'); }}
                        >
                          <div className="w-1 h-8 rounded-full bg-primary-600 group-hover:bg-primary-700 group-hover:w-1.5 transition-all shadow" />
                        </div>
                      </div>

                      {/* Time labels */}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[11px] font-mono text-primary-600 font-bold">{fmt(trimStart)}</span>
                        <span className="text-[10px] text-gray-400">{fmt(duration)} total</span>
                        <span className="text-[11px] font-mono text-primary-600 font-bold">{fmt(trimEnd)}</span>
                      </div>

                      {clipDuration > MAX_DURATION && (
                        <p className="mt-2 text-[11px] text-red-500 font-medium text-center">
                          El clip no puede superar {MAX_DURATION}s
                        </p>
                      )}
                    </div>
                  )}

                  {/* Duration info when no trim needed */}
                  {!needsTrim && duration > 0 && (
                    <p className="mt-1 text-center text-xs text-gray-400">
                      Duración: {fmt(duration)}
                    </p>
                  )}
                </div>
              )}

              {/* Description */}
              <div className="px-5 pt-2 pb-3">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Escribe una descripción..."
                  rows={2}
                  maxLength={500}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-primary-400 focus:bg-white transition"
                />
                <p className="text-right text-[10px] text-gray-400">{description.length}/500</p>
              </div>

              {/* Upload progress */}
              {busy && (
                <div className="px-5 pb-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin text-primary-600 shrink-0" />
                    <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary-600 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-600">{uploadProgress}%</span>
                  </div>
                </div>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleFileSelect}
                className="hidden"
              />
            </form>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
