import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';

let socket: Socket | null = null;
const backendBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export function getSocket(): Socket {
  if (!socket) {
    socket = io(`${backendBaseUrl}/realtime`, {
      autoConnect: false,
      auth: { token: getAccessToken() },
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  s.auth = { token: getAccessToken() };
  if (!s.connected) s.connect();
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
