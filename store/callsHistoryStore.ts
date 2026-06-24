import { create } from 'zustand';

export interface CallLog {
  id: string;
  caller_id: string;
  receiver_id: string;
  type: 'audio' | 'video';
  status: 'missed' | 'accepted' | 'rejected';
  duration: number;
  created_at: string;
  caller_name?: string;
  caller_avatar?: string;
  receiver_name?: string;
  receiver_avatar?: string;
  recording_url?: string;
}

interface CallsHistoryState {
  calls: CallLog[];
  isLoading: boolean;
  fetchCalls: (userId: string) => Promise<void>;
  logCall: (data: { caller_id: string; receiver_id: string; type: 'audio' | 'video'; status: 'missed' | 'accepted' | 'rejected'; duration?: number }) => Promise<CallLog | undefined>;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export const useCallsHistoryStore = create<CallsHistoryState>((set, get) => ({
  calls: [],
  isLoading: false,

  fetchCalls: async (userId: string) => {
    try {
      set({ isLoading: true });
      const res = await fetch(`${API_URL}/api/calls/${userId}`);
      if (!res.ok) throw new Error('Failed to fetch call history');
      const data = await res.json();
      set({ calls: data });
    } catch (err) {
      console.error(err);
    } finally {
      set({ isLoading: false });
    }
  },

  logCall: async (data) => {
    try {
      const res = await fetch(`${API_URL}/api/calls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to log call');
      const newCall = await res.json();
      // Optimistically add it to the list if we already fetched
      set((state) => ({ calls: [newCall, ...state.calls] }));
      return newCall;
    } catch (err) {
      console.error(err);
      return undefined;
    }
  },
}));
