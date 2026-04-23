'use client';

import { useRef, useEffect } from 'react';

interface Props {
  analyser: AnalyserNode | null;
  barCount?: number;
  height?: number;
  barColor?: string;
  className?: string;
}

export default function LiveWaveform({
  analyser,
  barCount = 40,
  height = 32,
  barColor = '#ef4444',
  className = '',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufLen = analyser.frequencyBinCount;
    const dataArr = new Uint8Array(bufLen);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArr);

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const barW = Math.max(2, (w / barCount) * 0.6);
      const gap = (w - barW * barCount) / (barCount - 1 || 1);

      for (let i = 0; i < barCount; i++) {
        // Sample from frequency data
        const idx = Math.floor((i / barCount) * bufLen * 0.6);
        const val = dataArr[idx] / 255;
        const barH = Math.max(3, val * h * 0.95);
        const x = i * (barW + gap);
        const y = (h - barH) / 2;

        ctx.fillStyle = barColor;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, barH, barW / 2);
        ctx.fill();
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [analyser, barCount, height, barColor]);

  return (
    <canvas
      ref={canvasRef}
      width={barCount * 5}
      height={height}
      className={`${className}`}
      style={{ height, imageRendering: 'auto' }}
    />
  );
}
