import { create } from 'zustand';
import api, { setAccessToken } from './api';
import type { User } from './types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { username: string; email: string; password: string; displayName: string }) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    const me = await api.get('/users/me');
    set({ user: me.data });
  },

  register: async (body) => {
    const { data } = await api.post('/auth/register', body);
    setAccessToken(data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    const me = await api.get('/users/me');
    set({ user: me.data });
  },

  logout: async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) await api.post('/auth/logout', { refreshToken });
    } catch { /* ignore */ }
    setAccessToken(null);
    localStorage.removeItem('refreshToken');
    set({ user: null });
  },

  setUser: (user) => set({ user }),

  loadUser: async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) { set({ loading: false }); return; }
      const { data: tokens } = await api.post('/auth/refresh', { refreshToken });
      setAccessToken(tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
      const me = await api.get('/users/me');
      set({ user: me.data, loading: false });
    } catch {
      setAccessToken(null);
      localStorage.removeItem('refreshToken');
      set({ user: null, loading: false });
    }
  },
}));
