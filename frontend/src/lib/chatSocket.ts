import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';

let chatSocket: Socket | null = null;
const backendBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export function getChatSocket(): Socket {
  if (!chatSocket) {
    chatSocket = io(`${backendBaseUrl}/chat`, {
      autoConnect: false,
      auth: { token: getAccessToken() },
    });
  }
  return chatSocket;
}

export function connectChatSocket() {
  const s = getChatSocket();
  s.auth = { token: getAccessToken() };
  if (!s.connected) s.connect();
}

export function disconnectChatSocket() {
  if (chatSocket) {
    chatSocket.disconnect();
    chatSocket = null;
  }
}
