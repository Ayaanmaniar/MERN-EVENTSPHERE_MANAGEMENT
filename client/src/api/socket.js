import { io } from 'socket.io-client';

let socket = null;

export function connectSocket() {
  if (socket) socket.disconnect();
  socket = io('/', { auth: { token: localStorage.getItem('es_token') || undefined } });
  return socket;
}
export function getSocket() {
  return socket || connectSocket();
}
export function disconnectSocket() {
  if (socket) socket.disconnect();
  socket = null;
}
