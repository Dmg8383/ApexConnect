import { create } from 'zustand';
import { api } from '@/lib/api';
import {
  joinConversation,
  leaveConversation,
  getSocket,
  emitTyping,
} from '@/lib/ws';
import { playSound } from '@/lib/sounds';
import {
  Message,
  Conversation,
  ConversationWithDetails,
  MessageWithStatus,
} from '@/types/database';
import { useAuthStore } from './authStore';

interface MessagesState {
  conversations: ConversationWithDetails[];
  currentConversation: ConversationWithDetails | null;
  messages: Record<string, MessageWithStatus[]>;
  typingUsers: Record<string, string[]>;
  isLoading: boolean;
  error: string | null;

  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  sendMessage: (
    conversationId: string,
    content: string,
    type?: Message['message_type']
  ) => Promise<Message>;
  createDirectConversation: (otherUserId: string) => Promise<Conversation>;
  markAsRead: (conversationId: string) => Promise<void>;
  setTyping: (conversationId: string, isTyping: boolean) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  subscribeToConversation: (conversationId: string) => void;
  unsubscribeFromConversation: (conversationId: string) => void;
  clearAllMessages: () => Promise<void>;
  clearConversation: (conversationId: string) => Promise<void>;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: {},
  typingUsers: {},
  isLoading: false,
  error: null,

  loadConversations: async () => {
    set({ isLoading: true });
    try {
      const conversations = await api.get<ConversationWithDetails[]>(
        '/api/conversations'
      );
      set({ conversations, isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to load conversations',
        isLoading: false,
      });
    }
  },

  loadMessages: async (conversationId: string) => {
    set({ isLoading: true });
    try {
      const messages = await api.get<MessageWithStatus[]>(
        `/api/conversations/${conversationId}/messages`
      );
      set((state) => ({
        messages: { ...state.messages, [conversationId]: messages },
        isLoading: false,
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to load messages',
        isLoading: false,
      });
    }
  },

  sendMessage: async (
    conversationId: string,
    content: string,
    type: Message['message_type'] = 'text',
    mediaUrl: string | null = null
  ) => {
    const message = await api.post<MessageWithStatus>('/api/messages', {
      conversation_id: conversationId,
      content,
      message_type: type,
      media_url: mediaUrl,
    });

    // Optimistically add to local state (server also broadcasts via Socket.io)
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [
          ...(state.messages[conversationId] || []),
          message,
        ],
      },
    }));

    return message;
  },

  createDirectConversation: async (otherUserId: string) => {
    return api.post<Conversation>('/api/conversations', { otherUserId });
  },

  markAsRead: async (conversationId: string) => {
    const { messages } = get();
    const userId = useAuthStore.getState().userId;
    const convMessages = messages[conversationId] || [];

    const unreadIds = convMessages
      .filter((m) => m.sender_id !== userId)
      .map((m) => m.id);

    if (unreadIds.length === 0) return;

    await api.post('/api/messages/status', {
      message_ids: unreadIds,
      status: 'read',
    });

    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unread_count: 0 } : c
      ),
    }));
  },

  setTyping: async (conversationId: string, isTyping: boolean) => {
    const userId = useAuthStore.getState().userId;
    if (userId) {
      emitTyping(conversationId, userId, isTyping);
    }
  },

  deleteMessage: async (messageId: string) => {
    await api.delete(`/api/messages/${messageId}`);

    set((state) => {
      const newMessages: Record<string, MessageWithStatus[]> = {};
      for (const [convId, msgs] of Object.entries(state.messages)) {
        newMessages[convId] = msgs.filter((m) => m.id !== messageId);
      }
      return { messages: newMessages };
    });
  },

  editMessage: async (messageId: string, content: string) => {
    try {
      await api.patch(`/api/messages/${messageId}`, { content });

      set((state) => {
        const newMessages: Record<string, MessageWithStatus[]> = {};
        for (const [convId, msgs] of Object.entries(state.messages)) {
          newMessages[convId] = msgs.map((m) =>
            m.id === messageId ? { ...m, content, is_edited: true } : m
          );
        }
        return { messages: newMessages };
      });
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  },

  // Subscribe to realtime events for a conversation via Socket.io
  subscribeToConversation: (conversationId: string) => {
    joinConversation(conversationId);
    const socket = getSocket();
    if (!socket) return;

    socket.on('new_message', (message: MessageWithStatus) => {
      if (message.conversation_id !== conversationId) return;

      // Play sound if we received a message from someone else
      const { useAuthStore } = require('@/store/authStore');
      const currentUserId = useAuthStore.getState().userId;
      if (message.sender_id !== currentUserId) {
        playSound('receive');
        
        // Mark as delivered
        api.post('/api/messages/status', {
          message_ids: [message.id],
          status: 'delivered',
        }).catch(console.error);
      }

      set((state) => {
        // Optimistically update the conversation list
        const updatedConversations = state.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                last_message: message,
                unread_count: message.sender_id !== currentUserId ? c.unread_count + 1 : c.unread_count,
                updated_at: message.created_at,
              }
            : c
        ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

        return {
          messages: {
            ...state.messages,
            [conversationId]: [
              ...(state.messages[conversationId] || []),
              message,
            ],
          },
          conversations: updatedConversations,
        };
      });
      // Refresh sidebar conversation list from server to ensure accuracy
      get().loadConversations();
    });

    socket.on('message_updated', (message: MessageWithStatus) => {
      if (message.conversation_id !== conversationId) return;
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] || []).map((m) =>
            m.id === message.id ? { ...m, ...message } : m
          ),
        },
      }));
    });

    socket.on(
      'message_deleted',
      ({ id }: { id: string; conversation_id: string }) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: (state.messages[conversationId] || []).filter(
              (m) => m.id !== id
            ),
          },
        }));
      }
    );

    socket.on(
      'message_status_updated',
      ({ message_id, conversation_id, status }: { message_id: string; conversation_id: string; status: 'sent' | 'delivered' | 'read' }) => {
        if (conversation_id !== conversationId) return;
        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: (state.messages[conversationId] || []).map((m) =>
              m.id === message_id ? { ...m, status } : m
            ),
          },
        }));
      }
    );

    socket.on(
      'user_typing',
      ({
        userId,
        isTyping,
      }: {
        conversationId: string;
        userId: string;
        isTyping: boolean;
      }) => {
        set((state) => ({
          typingUsers: {
            ...state.typingUsers,
            [conversationId]: isTyping
              ? [
                  ...(state.typingUsers[conversationId] || []).filter(
                    (id) => id !== userId
                  ),
                  userId,
                ]
              : (state.typingUsers[conversationId] || []).filter(
                  (id) => id !== userId
                ),
          },
        }));
      }
    );
  },

  unsubscribeFromConversation: (conversationId: string) => {
    leaveConversation(conversationId);
    const socket = getSocket();
    if (socket) {
      socket.off('new_message');
      socket.off('message_updated');
      socket.off('message_deleted');
      socket.off('user_typing');
    }
  },

  clearAllMessages: async () => {
    try {
      await api.delete('/api/messages/clear-all');

      set((state) => {
        const clearedConversations = state.conversations.map(c => ({
          ...c,
          last_message: undefined,
        }));
        return {
          messages: {},
          conversations: clearedConversations as any,
        };
      });
    } catch (error) {
      console.error('Failed to clear chats:', error);
      throw error;
    }
  },

  clearConversation: async (conversationId: string) => {
    try {
      await api.delete(`/api/messages/clear/${conversationId}`);

      set((state) => {
        // Clear messages for this conversation
        const newMessages = { ...state.messages };
        newMessages[conversationId] = [];

        // Clear last_message preview for this conversation
        const updatedConversations = state.conversations.map(c =>
          c.id === conversationId ? { ...c, last_message: undefined } : c
        );

        return {
          messages: newMessages,
          conversations: updatedConversations as any,
        };
      });
    } catch (error) {
      console.error('Failed to clear conversation:', error);
      throw error;
    }
  },
}));
