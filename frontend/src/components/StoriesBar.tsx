'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import type { StoryGroup } from '@/lib/types';
import Avatar from './Avatar';

interface Props {
  onViewStories: (groups: StoryGroup[], startIndex: number) => void;
  onCreateStory: () => void;
}

export default function StoriesBar({ onViewStories, onCreateStory }: Props) {
  const me = useAuthStore((s) => s.user);
  const [groups, setGroups] = useState<StoryGroup[]>([]);

  useEffect(() => {
    api.get('/stories/feed').then((r) => setGroups(r.data ?? [])).catch(() => {});
  }, []);

  // Refresh on custom event
  useEffect(() => {
    const handler = () => {
      api.get('/stories/feed').then((r) => setGroups(r.data ?? [])).catch(() => {});
    };
    window.addEventListener('stories:refresh', handler);
    return () => window.removeEventListener('stories:refresh', handler);
  }, []);

  const myGroup = groups.find((g) => g.user.id === me?.id);
  const hasMyStory = !!myGroup;

  return (
    <div className="flex items-center gap-4 overflow-x-auto py-3 px-1 scrollbar-hide">
      {/* My story circle */}
      <div className="flex flex-col items-center gap-1 shrink-0">
        <div className="relative">
          <button
            onClick={() => {
              if (hasMyStory) {
                const idx = groups.findIndex((g) => g.user.id === me?.id);
                onViewStories(groups, idx >= 0 ? idx : 0);
              } else {
                onCreateStory();
              }
            }}
            className="block"
          >
            <div
              className={`rounded-full p-[3px] ${
                hasMyStory
                  ? myGroup!.hasUnviewed
                    ? 'bg-gradient-to-tr from-fuchsia-500 via-rose-500 to-amber-400'
                    : 'bg-gray-300'
                  : 'bg-transparent'
              }`}
            >
              <div className="rounded-full bg-white p-[2px]">
                <Avatar src={me?.avatarUrl ?? null} alt={me?.displayName ?? ''} size={56} />
              </div>
            </div>
          </button>
          <button
            onClick={() => onCreateStory()}
            className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-white ring-2 ring-white transition hover:scale-110 active:scale-90"
          >
            <Plus className="h-3 w-3" strokeWidth={3} />
          </button>
        </div>
        <span className="text-[11px] text-gray-500 max-w-[64px] truncate">Tu historia</span>
      </div>

      {/* Other users' stories */}
      {groups
        .filter((g) => g.user.id !== me?.id)
        .map((group, i) => {
          const globalIdx = groups.findIndex((g) => g.user.id === group.user.id);
          return (
            <button
              key={group.user.id}
              onClick={() => onViewStories(groups, globalIdx)}
              className="flex flex-col items-center gap-1 shrink-0"
            >
              <div
                className={`rounded-full p-[3px] ${
                  group.hasUnviewed
                    ? 'bg-gradient-to-tr from-fuchsia-500 via-rose-500 to-amber-400'
                    : 'bg-gray-300'
                }`}
              >
                <div className="rounded-full bg-white p-[2px]">
                  <Avatar src={group.user.avatarUrl} alt={group.user.displayName} size={56} />
                </div>
              </div>
              <span className="text-[11px] text-gray-500 max-w-[64px] truncate">
                {group.user.username}
              </span>
            </button>
          );
        })}
    </div>
  );
}
