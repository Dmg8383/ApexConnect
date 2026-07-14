import { io, Socket } from 'socket.io-client';
// usePresenceStore imported dynamically to avoid require cycle

const WS_URL =
  (process.env.EXPO_PUBLIC_API_URL as string) || 'http://localhost:3001';

let socket: Socket | null = null;

// ── Connection ─────────────────────────────────────────────────────────────────

export const connectSocket = (): Socket => {
  if (socket?.connected) return socket;

  socket = io(WS_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket.io connected:', socket?.id);
    
    // Register presence automatically if we have a user
    const { useAuthStore } = require('@/store/authStore');
    const { useMessagesStore } = require('@/store/messagesStore');
    const userId = useAuthStore.getState().userId;
    if (userId) {
      socket?.emit('register_user', userId);
    }
    
    // Initialize global message listeners
    useMessagesStore.getState().initRealtimeListeners();
  });

  socket.on('user_presence', ({ userId, status }) => {
    const { usePresenceStore } = require('@/store/presenceStore');
    usePresenceStore.getState().setPresence(userId, status);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket.io disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('Socket.io connect error:', err.message);
  });

  socket.on('account_deactivated', ({ userId }) => {
    const { useAuthStore } = require('@/store/authStore');
    const currentUserId = useAuthStore.getState().userId;
    if (currentUserId === userId) {
      console.log('Account deactivated by admin. Logging out immediately.');
      window.alert('Your account has been deactivated by an administrator. Please contact support.');
      useAuthStore.getState().signOut();
    }
  });

  return socket;
};

export const disconnectSocket = (): void => {
  socket?.disconnect();
  socket = null;
};

export const getSocket = (): Socket | null => socket;

// ── Room management ───────────────────────────────────────────────────────────

export const joinConversation = (conversationId: string): void => {
  socket?.emit('join_conversation', conversationId);
};

export const leaveConversation = (conversationId: string): void => {
  socket?.emit('leave_conversation', conversationId);
};

// ── Events ────────────────────────────────────────────────────────────────────

export const emitTyping = (
  conversationId: string,
  userId: string,
  isTyping: boolean
): void => {
  socket?.emit('typing', { conversationId, userId, isTyping });
};
