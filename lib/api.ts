import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Change this to your server IP when testing on a real device via Expo Go.
// For web (localhost) and Android emulator, localhost works fine.
const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_URL as string);

// ── Token storage (web uses localStorage, native uses SecureStore) ────────────

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem('auth_token')
      : null;
  }
  return SecureStore.getItemAsync('auth_token');
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem('auth_token', token);
    return;
  }
  return SecureStore.setItemAsync('auth_token', token);
}

export async function deleteToken(): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('auth_token');
    return;
  }
  return SecureStore.deleteItemAsync('auth_token');
}

// ── Generic fetch wrapper ─────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  requireAuth = true
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (requireAuth) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

// ── API client ────────────────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, requireAuth = true) =>
    request<T>('GET', path, undefined, requireAuth),

  post: <T>(path: string, body?: unknown, requireAuth = true) =>
    request<T>('POST', path, body, requireAuth),

  patch: <T>(path: string, body?: unknown) =>
    request<T>('PATCH', path, body),

  delete: <T>(path: string) =>
    request<T>('DELETE', path),

  upload: async <T>(path: string, formData: FormData, requireAuth = true): Promise<T> => {
    const headers: Record<string, string> = {};
    if (requireAuth) {
      const token = await getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(errorData.error || `Upload failed (${response.status})`);
    }
    return response.json() as Promise<T>;
  },

  setToken,
  getToken,
  deleteToken,
};
