import { create } from 'zustand/index.js';
import { getSocket } from '@/lib/ws';

interface PresenceState {
  presence: Record<string, 'online' | 'offline'>;
  setPresence: (userId: string, status: 'online' | 'offline') => void;
  setBulkPresence: (presences: Record<string, 'online' | 'offline'>) => void;
  fetchPresence: (userIds: string[]) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  presence: {},
  setPresence: (userId, status) =>
    set((state) => ({
      presence: { ...state.presence, [userId]: status },
    })),
  setBulkPresence: (presences) =>
    set((state) => ({
      presence: { ...state.presence, ...presences },
    })),
  fetchPresence: (userIds) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('get_presence', userIds, (result: Record<string, 'online' | 'offline'>) => {
        set((state) => ({
          presence: { ...state.presence, ...result },
        }));
      });
    }
  },
}));
