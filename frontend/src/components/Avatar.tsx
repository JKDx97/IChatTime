'use client';

import Image from 'next/image';
import { User } from 'lucide-react';

interface Props {
  src?: string | null;
  alt?: string;
  size?: number;
  className?: string;
}

export default function Avatar({ src, alt = '', size = 40, className = '' }: Props) {
  if (src) {
    return (
      <Image
        src={src.startsWith('http') ? src : `/uploads/${src}`}
        alt={alt}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gray-200 text-gray-500 ${className}`}
      style={{ width: size, height: size }}
    >
      <User className="h-1/2 w-1/2" />
    </div>
  );
}
