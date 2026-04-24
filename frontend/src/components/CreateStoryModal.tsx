'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Image as ImageIcon, Film, Loader2, Scissors, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const MAX_VIDEO_SECONDS = 30;

export default function CreateStoryModal({ open, onClose, onCreated }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Video trim state
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(MAX_VIDEO_SECONDS);
  const [needsTrim, setNeedsTrim] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      if (preview) URL.revokeObjectURL(preview);
      setFile(null);
      setPreview(null);
      setMediaType('image');
      setUploading(false);
      setDuration(0);
      setTrimStart(0);
      setTrimEnd(MAX_VIDEO_SECONDS);
      setNeedsTrim(false);
      setPlaying(false);
      setCurrentTime(0);
      setDragging(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !uploading) onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose, uploading]);

  // Drag handle listeners
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
        if (trimEnd - newStart > MAX_VIDEO_SECONDS) {
          setTrimEnd(newStart + MAX_VIDEO_SECONDS);
        }
        if (videoRef.current) videoRef.current.currentTime = newStart;
      } else {
        const newEnd = Math.min(duration, Math.max(time, trimStart + 1));
        setTrimEnd(newEnd > trimStart + MAX_VIDEO_SECONDS ? trimStart + MAX_VIDEO_SECONDS : newEnd);
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

  function handleFile(f: File) {
    if (f.size > 100 * 1024 * 1024) {
      toast.error('Máximo 100 MB');
      return;
    }
    const isVideo = f.type.startsWith('video/');
    setMediaType(isVideo ? 'video' : 'image');
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function handleVideoMetadata() {
    const v = videoRef.current;
    if (!v) return;
    const d = v.duration;
    setDuration(d);
    if (d > MAX_VIDEO_SECONDS) {
      setNeedsTrim(true);
      setTrimStart(0);
      setTrimEnd(MAX_VIDEO_SECONDS);
      toast('El video supera 30s. Ajusta el recorte.', { icon: '✂️' });
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

  function handleTimelineClick(e: React.MouseEvent) {
    if (dragging) return;
    const rect = timelineRef.current!.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    seekTo(pct * duration);
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
        const trimmed = new File([blob], 'story.webm', { type: 'video/webm' });
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

  async function handleSubmit() {
    if (!file || uploading) return;
    setUploading(true);
    try {
      let uploadFile = file;

      if (mediaType === 'video' && needsTrim) {
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
      fd.append('media', uploadFile);
      await api.post('/stories', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Historia publicada');
      onCreated();
      onClose();
      window.dispatchEvent(new Event('stories:refresh'));
    } catch {
      toast.error('No se pudo subir la historia');
    }
    setUploading(false);
  }

  function clearFile() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setDuration(0);
    setTrimStart(0);
    setTrimEnd(MAX_VIDEO_SECONDS);
    setNeedsTrim(false);
    setPlaying(false);
    setCurrentTime(0);
  }

  if (!open) return null;

  const clipDuration = trimEnd - trimStart;
  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const startPct = duration > 0 ? (trimStart / duration) * 100 : 0;
  const endPct = duration > 0 ? (trimEnd / duration) * 100 : 100;
  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={() => !uploading && onClose()} />
      <div className="relative z-10 w-full max-w-md md:mx-4 animate-slide-up md:animate-modal-enter">
        <div className="rounded-t-2xl md:rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 shrink-0">
            <h2 className="text-base font-bold">Nueva Historia</h2>
            <button onClick={() => !uploading && onClose()} className="rounded-full p-1 hover:bg-gray-100 transition">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!file ? (
              /* File picker */
              <div
                className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition cursor-pointer ${
                  dragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
              >
                <Upload className="h-10 w-10 text-gray-300" />
                <p className="text-sm text-gray-500 text-center">
                  Arrastra una <strong>imagen</strong> o <strong>video</strong> (máx 30s)
                </p>
                <p className="text-xs text-gray-400">o haz clic para seleccionar</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                />
              </div>
            ) : (
              /* Preview */
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-black flex items-center justify-center mx-auto" style={{ aspectRatio: '9/16', maxHeight: '400px', width: 'fit-content' }}>
                  {mediaType === 'video' ? (
                    <>
                      <video
                        ref={videoRef}
                        src={preview!}
                        className="w-full h-full object-contain"
                        playsInline
                        onLoadedMetadata={handleVideoMetadata}
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={() => setPlaying(false)}
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
                      {duration > 0 && (
                        <div className="absolute left-2 bottom-2 rounded-md bg-black/60 px-2 py-0.5">
                          <span className="text-[11px] font-mono text-white">{fmt(currentTime)} / {fmt(needsTrim ? clipDuration : duration)}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <img src={preview!} alt="" className="w-full h-full object-contain" />
                  )}
                  <button
                    type="button"
                    onClick={clearFile}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Video playback controls */}
                {mediaType === 'video' && duration > 0 && (
                  <>
                    <div className="flex items-center justify-center gap-4">
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

                    {/* Trim timeline */}
                    {needsTrim && (
                      <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Scissors className="h-4 w-4 text-primary-600" />
                          <span className="text-xs font-bold text-gray-700">
                            Recortar — {fmt(clipDuration)} seleccionados
                          </span>
                          <span className="ml-auto text-[10px] text-gray-400">máx {MAX_VIDEO_SECONDS}s</span>
                        </div>

                        <div
                          ref={timelineRef}
                          className="relative h-12 rounded-lg bg-gray-200 cursor-pointer select-none overflow-hidden"
                          onClick={handleTimelineClick}
                        >
                          <div
                            className="absolute inset-y-0 left-0 bg-black/30 rounded-l-lg pointer-events-none"
                            style={{ width: `${startPct}%` }}
                          />
                          <div
                            className="absolute inset-y-0 right-0 bg-black/30 rounded-r-lg pointer-events-none"
                            style={{ width: `${100 - endPct}%` }}
                          />
                          <div
                            className="absolute inset-y-0 bg-primary-100 border-y-2 border-primary-500 pointer-events-none"
                            style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
                          />
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-20"
                            style={{ left: `${playheadPct}%` }}
                          >
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-500" />
                          </div>
                          <div
                            className="absolute top-0 bottom-0 w-4 cursor-ew-resize z-30 group flex items-center justify-center"
                            style={{ left: `calc(${startPct}% - 8px)` }}
                            onMouseDown={(e) => { e.stopPropagation(); setDragging('start'); }}
                            onTouchStart={(e) => { e.stopPropagation(); setDragging('start'); }}
                          >
                            <div className="w-1 h-8 rounded-full bg-primary-600 group-hover:bg-primary-700 group-hover:w-1.5 transition-all shadow" />
                          </div>
                          <div
                            className="absolute top-0 bottom-0 w-4 cursor-ew-resize z-30 group flex items-center justify-center"
                            style={{ left: `calc(${endPct}% - 8px)` }}
                            onMouseDown={(e) => { e.stopPropagation(); setDragging('end'); }}
                            onTouchStart={(e) => { e.stopPropagation(); setDragging('end'); }}
                          >
                            <div className="w-1 h-8 rounded-full bg-primary-600 group-hover:bg-primary-700 group-hover:w-1.5 transition-all shadow" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[11px] font-mono text-primary-600 font-bold">{fmt(trimStart)}</span>
                          <span className="text-[10px] text-gray-400">{fmt(duration)} total</span>
                          <span className="text-[11px] font-mono text-primary-600 font-bold">{fmt(trimEnd)}</span>
                        </div>

                        {clipDuration > MAX_VIDEO_SECONDS && (
                          <p className="mt-2 text-[11px] text-red-500 font-medium text-center">
                            El clip no puede superar {MAX_VIDEO_SECONDS}s
                          </p>
                        )}
                      </div>
                    )}

                    {!needsTrim && (
                      <p className="text-center text-xs text-gray-400">
                        Duración: {fmt(duration)}
                      </p>
                    )}
                  </>
                )}

                <div className="flex items-center gap-2 text-xs text-gray-400">
                  {mediaType === 'video' ? <Film className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                  <span>{mediaType === 'video' ? 'Video' : 'Imagen'} · Desaparece en 24h</span>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          {file && (
            <div className="border-t border-gray-100 p-4">
              <button
                onClick={handleSubmit}
                disabled={uploading || (mediaType === 'video' && needsTrim && clipDuration > MAX_VIDEO_SECONDS)}
                className="w-full rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  'Publicar historia'
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>,
    document.body,
  );
}
