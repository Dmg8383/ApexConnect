import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { generateMnemonic } from '@/lib/mnemonic';
import { api } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/ws';
import { User } from '@/types/database';

// ── Cross-platform mnemonic storage ──────────────────────────────────────────
// expo-secure-store is native-only and throws on web.
// On web we fall back to localStorage (acceptable for a dev/demo app).

async function getMnemonic(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem('mnemonic')
      : null;
  }
  return SecureStore.getItemAsync('mnemonic');
}

async function saveMnemonic(mnemonic: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mnemonic', mnemonic);
    }
    return;
  }
  return SecureStore.setItemAsync('mnemonic', mnemonic);
}

async function deleteMnemonic(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('mnemonic');
    }
    return;
  }
  return SecureStore.deleteItemAsync('mnemonic');
}

// ─────────────────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null;
  userId: string | null;
  mnemonic: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  theme: 'light' | 'dark';

  setTheme: (theme: 'light' | 'dark') => void;
  setUser: (user: User | null) => void;
  generateUserId: () => string;
  generateMnemonic: () => string;
  createAccount: (displayName: string, username?: string, password?: string) => Promise<void>;
  signIn: (username: string, password?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  loadUser: () => Promise<void>;
  requestOtp: (phoneNumber: string) => Promise<any>;
  verifyOtp: (phoneNumber: string, code: string) => Promise<void>;
}

const CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const generateAlphanumericId = (): string => {
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += CHARACTERS.charAt(Math.floor(Math.random() * CHARACTERS.length));
  }
  return result;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      userId: null,
      mnemonic: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      theme: 'light',

      setTheme: (theme) => set({ theme }),
      setUser: (user) => set({ user }),
      generateUserId: () => generateAlphanumericId(),
      generateMnemonic: () => generateMnemonic(12),

      createAccount: async (displayName: string, username?: string, password?: string) => {
        set({ isLoading: true, error: null });
        try {
          const mnemonic = generateMnemonic(12);

          const { user, token } = await api.post<{ user: User; token: string }>(
            '/api/users',
            { display_name: displayName, username, password },
            false
          );

          await api.setToken(token);
          await saveMnemonic(mnemonic);  // ← cross-platform

          connectSocket();

          set({
            user,
            userId: user.id,
            mnemonic,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create account',
            isLoading: false,
          });
          throw error;
        }
      },

      signIn: async (username: string, password?: string) => {
        set({ isLoading: true, error: null });
        try {
          const { user, token } = await api.post<{ user: User; token: string }>(
            '/api/users/signin',
            { username, password },
            false
          );

          await api.setToken(token);
          const storedMnemonic = await getMnemonic();  // ← cross-platform

          connectSocket();

          set({
            user,
            userId: user.id,
            mnemonic: storedMnemonic,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to sign in',
            isLoading: false,
          });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      requestOtp: async (phoneNumber: string) => {
        set({ isLoading: true, error: null });
        try {
          const res = await api.post<any>('/api/users/request-otp', { phone_number: phoneNumber }, false);
          return res;
        } catch (err: any) {
          set({ error: err.message });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      verifyOtp: async (phoneNumber: string, code: string) => {
        set({ isLoading: true, error: null });
        try {
          const { user, token } = await api.post<{ user: User; token: string }>(
            '/api/users/verify-otp',
            { phone_number: phoneNumber, code },
            false
          );

          await api.setToken(token);
          set({ user, userId: user.id, isAuthenticated: true });
          connectSocket(user.id);
        } catch (err: any) {
          set({ error: err.message });
          throw err;
        } finally {
          set({ isLoading: false });
        }
      },

      signOut: async () => {
        try {
          await api.post('/api/users/logout');
        } catch (e) {
          console.error('Logout logging failed', e);
        }
        await api.deleteToken();
        await deleteMnemonic();  // ← cross-platform
        disconnectSocket();
        set({
          user: null,
          userId: null,
          mnemonic: null,
          isAuthenticated: false,
        });
      },

      updateProfile: async (updates: Partial<User>) => {
        const user = await api.patch<User>('/api/users/me', updates);
        set({ user });
      },

      loadUser: async () => {
        set({ isLoading: true });
        try {
          const token = await api.getToken();
          if (!token) {
            set({ isLoading: false });
            return;
          }

          // Decode JWT payload (base64) to get userId without a library
          const payloadBase64 = token.split('.')[1];
          const payload = JSON.parse(atob(payloadBase64));

          const storedMnemonic = await getMnemonic();  // ← cross-platform

          const user = await api.get<User>(`/api/users/${payload.userId}`);

          connectSocket();

          set({
            user,
            userId: user.id,
            mnemonic: storedMnemonic,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          // Token invalid or server unreachable — stay logged out
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ userId: state.userId }),
    }
  )
);
