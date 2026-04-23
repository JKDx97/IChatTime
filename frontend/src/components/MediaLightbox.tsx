'use client';

import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  urls: string[];
  startIndex?: number;
  onClose: () => void;
  onChangeIndex?: (index: number) => void;
}

function getMediaUrl(url: string) {
  return url.startsWith('http') ? url : `/uploads/${url}`;
}

function isVideo(url: string) {
  return /\.(mp4|webm|mov|quicktime)$/i.test(url);
}

export default function MediaLightbox({
  urls,
  startIndex = 0,
  onClose,
  onChangeIndex,
}: Props) {
  const index = startIndex;

  const goPrev = useCallback(() => {
    if (index > 0) onChangeIndex?.(index - 1);
  }, [index, onChangeIndex]);

  const goNext = useCallback(() => {
    if (index < urls.length - 1) onChangeIndex?.(index + 1);
  }, [index, urls.length, onChangeIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, goPrev, goNext]);

  const src = getMediaUrl(urls[index]);
  const isVid = isVideo(urls[index]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="fixed right-4 top-4 z-[101] rounded-full bg-black/60 p-2.5 text-white shadow-lg transition hover:bg-black/80"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Prev */}
      {urls.length > 1 && index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-4 z-10 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Next */}
      {urls.length > 1 && index < urls.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-4 z-10 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Media */}
      <div
        className="relative max-h-[90vh] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {isVid ? (
          <video
            src={src}
            controls
            autoPlay
            className="max-h-[90vh] max-w-[90vw] rounded-lg"
          />
        ) : (
          <Image
            src={src}
            alt=""
            width={1200}
            height={900}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            sizes="90vw"
            priority
          />
        )}
      </div>

      {/* Counter */}
      {urls.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
          {index + 1} / {urls.length}
        </div>
      )}
    </div>,
    document.body,
  );
}
