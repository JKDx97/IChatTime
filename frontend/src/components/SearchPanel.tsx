'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Search, X, Clock, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import type { User } from '@/lib/types';
import Avatar from './Avatar';

const HISTORY_KEY = 'ichattime_search_history';
const MAX_HISTORY = 20;

interface RecentUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  visitedAt: number;
}

function getHistory(): RecentUser[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveHistory(items: RecentUser[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SearchPanel({ open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searched, setSearched] = useState(false);
  const [history, setHistory] = useState<RecentUser[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
      setHistory(getHistory());
    } else {
      setQuery('');
      setResults([]);
      setSearched(false);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setSearched(false); return; }
    try {
      const { data } = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
      setResults(data);
      setSearched(true);
    } catch { /* ignore */ }
  }, []);

  function handleSearch(q: string) {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setResults([]); setSearched(false); return; }
    debounceRef.current = setTimeout(() => doSearch(q), 300);
  }

  function addToHistory(user: User) {
    const entry: RecentUser = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      visitedAt: Date.now(),
    };
    const updated = [entry, ...getHistory().filter((h) => h.id !== user.id)].slice(0, MAX_HISTORY);
    saveHistory(updated);
    setHistory(updated);
  }

  function removeFromHistory(id: string) {
    const updated = getHistory().filter((h) => h.id !== id);
    saveHistory(updated);
    setHistory(updated);
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  }

  function handleResultClick(user: User) {
    addToHistory(user);
    onClose();
  }

  function handleHistoryClick(h: RecentUser) {
    onClose();
  }

  const showHistory = !searched && query.trim().length < 2;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:bg-transparent"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed inset-y-0 z-40 flex w-[320px] flex-col border-r border-gray-200 bg-white shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]
          md:left-[72px] xl:left-[72px]
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-6">
          <h2 className="text-2xl font-bold text-gray-900">Buscar</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search input */}
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Buscar usuarios…"
              className="w-full rounded-lg bg-gray-100 py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:bg-gray-50 focus:ring-2 focus:ring-primary-500/20"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setResults([]); setSearched(false); inputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-gray-300 p-0.5 text-white transition hover:bg-gray-400"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {/* ── Search results ── */}
          {!showHistory && (
            <>
              {results.map((u) => (
                <Link
                  key={u.id}
                  href={`/profile/${u.username}`}
                  onClick={() => handleResultClick(u)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-150 hover:bg-gray-50 active:scale-[0.98]"
                >
                  <Avatar src={u.avatarUrl} alt={u.displayName} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{u.displayName}</p>
                    <p className="truncate text-xs text-gray-500">@{u.username}</p>
                  </div>
                </Link>
              ))}
              {searched && results.length === 0 && (
                <p className="py-12 text-center text-sm text-gray-400">No se encontraron usuarios</p>
              )}
            </>
          )}

          {/* ── History / Recientes ── */}
          {showHistory && (
            <>
              {history.length > 0 ? (
                <>
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                      <Clock className="h-4 w-4" />
                      Recientes
                    </div>
                    <button
                      onClick={clearHistory}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-red-500 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      Borrar todo
                    </button>
                  </div>
                  {history.map((h) => (
                    <div key={h.id} className="group flex items-center rounded-lg transition-all duration-150 hover:bg-gray-50">
                      <Link
                        href={`/profile/${h.username}`}
                        onClick={() => handleHistoryClick(h)}
                        className="flex flex-1 items-center gap-3 px-3 py-2.5"
                      >
                        <Avatar src={h.avatarUrl} alt={h.displayName} size={44} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900">{h.displayName}</p>
                          <p className="truncate text-xs text-gray-500">@{h.username}</p>
                        </div>
                      </Link>
                      <button
                        onClick={() => removeFromHistory(h.id)}
                        title="Eliminar"
                        className="mr-2 rounded-full p-1.5 text-gray-300 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </>
              ) : (
                <p className="py-12 text-center text-sm text-gray-400">
                  Escribe para buscar personas
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
