'use client';

import { MessageCircle } from 'lucide-react';

interface Props {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

const sizes = {
  sm: { icon: 'h-8 w-8', text: 'text-sm', container: 'gap-3' },
  md: { icon: 'h-12 w-12', text: 'text-lg', container: 'gap-4' },
  lg: { icon: 'h-16 w-16', text: 'text-xl', container: 'gap-5' },
};

export default function LoadingLogo({ size = 'md', text }: Props) {
  const s = sizes[size];

  return (
    <div className={`flex flex-col items-center justify-center ${s.container}`}>
      <div className="relative">
        <div className="animate-logo-pulse">
          <MessageCircle
            className={`${s.icon} text-primary-600 drop-shadow-lg`}
            strokeWidth={1.8}
          />
        </div>
        {/* Ripple rings */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-logo-ring absolute rounded-full border-2 border-primary-400/40" style={{ width: '150%', height: '150%' }} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-logo-ring-delayed absolute rounded-full border border-primary-300/25" style={{ width: '200%', height: '200%' }} />
        </div>
      </div>
      {text !== undefined ? (
        text && (
          <span className={`${s.text} font-semibold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent`}>
            {text}
          </span>
        )
      ) : (
        <span className={`${s.text} font-semibold bg-gradient-to-r from-primary-600 to-primary-500 bg-clip-text text-transparent`}>
          IChatTime
        </span>
      )}
    </div>
  );
}
