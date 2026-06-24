import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { api } from './api';
import { useAuthStore } from '@/store/authStore';

const PENDING_MESSAGES_KEY = 'pending_messages';

interface PendingMessage {
  tempId: string;
  conversationId: string;
  content: string;
  messageType: string;
  retries: number;
  createdAt: number;
}

class OfflineSyncService {
  private isOnline: boolean = true;
  private syncInProgress: boolean = false;
  private unsubscribe: (() => void) | null = null;

  init() {
    this.unsubscribe = NetInfo.addEventListener(this.handleConnectivityChange);
    this.checkInitialConnection();
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private async checkInitialConnection() {
    const state = await NetInfo.fetch();
    this.handleConnectivityChange(state);
  }

  private handleConnectivityChange = async (state: NetInfoState) => {
    const wasOffline = !this.isOnline;
    this.isOnline = state.isConnected ?? false;

    if (wasOffline && this.isOnline) {
      await this.syncPendingMessages();
    }
  };

  async queueMessage(
    conversationId: string,
    content: string,
    messageType = 'text'
  ): Promise<string> {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const pending = await this.getPendingMessages();
    pending.push({
      tempId,
      conversationId,
      content,
      messageType,
      retries: 0,
      createdAt: Date.now(),
    });
    await AsyncStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(pending));

    if (this.isOnline) {
      this.syncPendingMessages();
    }

    return tempId;
  }

  private async getPendingMessages(): Promise<PendingMessage[]> {
    const data = await AsyncStorage.getItem(PENDING_MESSAGES_KEY);
    return data ? JSON.parse(data) : [];
  }

  private async syncPendingMessages(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) return;
    this.syncInProgress = true;

    try {
      const userId = useAuthStore.getState().userId;
      if (!userId) return;

      const pending = await this.getPendingMessages();
      if (pending.length === 0) return;

      const remaining: PendingMessage[] = [];
      const maxRetries = 5;

      for (const msg of pending) {
        if (msg.retries >= maxRetries) continue; // drop after max retries

        try {
          await api.post('/api/messages', {
            conversation_id: msg.conversationId,
            content: msg.content,
            message_type: msg.messageType || 'text',
          });
        } catch {
          msg.retries++;
          remaining.push(msg);
        }
      }

      await AsyncStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(remaining));
    } finally {
      this.syncInProgress = false;
    }
  }

  isConnected(): boolean {
    return this.isOnline;
  }
}

export const offlineSyncService = new OfflineSyncService();
