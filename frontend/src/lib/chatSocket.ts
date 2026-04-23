import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';

let chatSocket: Socket | null = null;

export function getChatSocket(): Socket {
  if (!chatSocket) {
    chatSocket = io('http://localhost:4000/chat', {
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
