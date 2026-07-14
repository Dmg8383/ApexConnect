import { create } from 'zustand/index.js';
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

export interface MessagesState {
  conversations: ConversationWithDetails[];
  messages: Record<string, MessageWithStatus[]>;
  typingUsers: Record<string, string[]>;
  isLoading: boolean;
  error: string | null;
  activeConversationId: string | null;

  setActiveConversationId: (id: string | null) => void;
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
  createGroupConversation: (name: string, participantIds: string[]) => Promise<Conversation>;
  addGroupParticipants: (conversationId: string, participantIds: string[]) => Promise<void>;
  removeGroupParticipant: (conversationId: string, userId: string) => Promise<void>;
  updateParticipantRole: (conversationId: string, userId: string, role: string) => Promise<void>;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  activeConversationId: null,
  messages: {},
  typingUsers: {},
  isLoading: false,
  error: null,

  setActiveConversationId: (id: string | null) => set({ activeConversationId: id }),

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

  createGroupConversation: async (name: string, participantIds: string[]) => {
    return api.post<Conversation>('/api/conversations/group', { name, participants: participantIds });
  },

  addGroupParticipants: async (conversationId: string, participantIds: string[]) => {
    await api.post(`/api/conversations/${conversationId}/participants`, { participants: participantIds });
  },

  removeGroupParticipant: async (conversationId: string, userId: string) => {
    await api.delete(`/api/conversations/${conversationId}/participants/${userId}`);
  },

  updateParticipantRole: async (conversationId: string, userId: string, role: string) => {
    await api.patch(`/api/conversations/${conversationId}/participants/${userId}/role`, { role });
  },

  markAsRead: async (conversationId: string) => {
    const { messages } = get();
    const userId = useAuthStore.getState().userId;
    const convMessages = messages[conversationId] || [];

    const unreadMessages = convMessages.filter((m) => m.sender_id !== userId && m.status !== 'read');
    const unreadIds = unreadMessages.map((m) => m.id);

    // Always clear the unread_count badge optimistically 
    // (even if unreadIds is empty, because local state might not have the unread messages loaded)
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unread_count: 0 } : c
      ),
    }));

    if (unreadIds.length === 0) return;

    // Optimistically update local message status
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map((m) =>
          unreadIds.includes(m.id) ? { ...m, status: 'read' } : m
        ),
      },
    }));

    try {
      await api.post('/api/messages/status', {
        message_ids: unreadIds,
        status: 'read',
      });
    } catch (e) {
      console.error('Failed to mark as read on server:', e);
    }
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

  initRealtimeListeners: () => {
    const socket = getSocket();
    if (!socket) return;
    
    // Prevent duplicate listeners
    if (socket.listeners('new_message').length > 0) return;

    socket.on('new_message', (message: MessageWithStatus) => {
      // Play sound if we received a message from someone else
      const { useAuthStore } = require('@/store/authStore');
      const currentUserId = useAuthStore.getState().userId;
      if (message.sender_id !== currentUserId) {
        playSound('receive');
      }

      set((state) => {
        // Optimistically update the conversation list
        const updatedConversations = state.conversations.map((c) =>
          c.id === message.conversation_id
            ? {
                ...c,
                last_message: message,
                unread_count: message.sender_id !== currentUserId && state.activeConversationId !== message.conversation_id 
                   ? c.unread_count + 1 
                   : c.unread_count,
                updated_at: message.created_at,
              }
            : c
        );
        
        // If it's a new conversation not in our list, we should fetch conversations
        const convExists = state.conversations.some(c => c.id === message.conversation_id);
        if (!convExists) {
          get().loadConversations();
        }

        updatedConversations.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

        return {
          messages: {
            ...state.messages,
            [message.conversation_id]: [
              ...(state.messages[message.conversation_id] || []),
              message,
            ],
          },
          conversations: updatedConversations,
        };
      });
    });

    socket.on('message_updated', (message: MessageWithStatus) => {
      set((state) => ({
        messages: {
          ...state.messages,
          [message.conversation_id]: (state.messages[message.conversation_id] || []).map((m) =>
            m.id === message.id ? { ...m, ...message } : m
          ),
        },
      }));
    });

    socket.on(
      'message_deleted',
      ({ id, conversation_id }: { id: string; conversation_id: string }) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [conversation_id]: (state.messages[conversation_id] || []).filter(
              (m) => m.id !== id
            ),
          },
        }));
      }
    );

    socket.on(
      'message_status_updated',
      ({ message_id, conversation_id, status }: { message_id: string; conversation_id: string; status: 'sent' | 'delivered' | 'read' }) => {
        const { useAuthStore } = require('@/store/authStore');
        const currentUserId = useAuthStore.getState().userId;

        set((state) => {
          const conversationMessages = state.messages[conversation_id] || [];
          
          // Check if this message was sent by someone else
          // If we receive a 'read' status for it, it means WE read it on another device
          const message = conversationMessages.find(m => m.id === message_id);
          const wasSentByMe = message?.sender_id === currentUserId;
          
          let updatedConversations = state.conversations;
          if (status === 'read' && !wasSentByMe) {
            updatedConversations = state.conversations.map(c => 
              c.id === conversation_id ? { ...c, unread_count: 0 } : c
            );
          }

          return {
            messages: {
              ...state.messages,
              [conversation_id]: conversationMessages.map((m) =>
                m.id === message_id ? { ...m, status } : m
              ),
            },
            conversations: updatedConversations,
          };
        });
      }
    );

    socket.on(
      'user_typing',
      ({
        conversationId,
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

  subscribeToConversation: (conversationId: string) => {
    joinConversation(conversationId);
  },

  unsubscribeFromConversation: (conversationId: string) => {
    leaveConversation(conversationId);
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
        const newMessages = { ...state.messages };
        newMessages[conversationId] = [];

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

  addGroupParticipants: async (conversationId: string, participantIds: string[]) => {
    try {
      await api.post(`/api/conversations/${conversationId}/participants`, { participants: participantIds });
    } catch (error) {
      console.error('Failed to add group participants:', error);
      throw error;
    }
  },

  removeGroupParticipant: async (conversationId: string, userId: string) => {
    try {
      await api.delete(`/api/conversations/${conversationId}/participants/${userId}`);
    } catch (error) {
      console.error('Failed to remove group participant:', error);
      throw error;
    }
  },

  updateParticipantRole: async (conversationId: string, userId: string, role: string) => {
    try {
      await api.patch(`/api/conversations/${conversationId}/participants/${userId}/role`, { role });
    } catch (error) {
      console.error('Failed to update participant role:', error);
      throw error;
    }
  },
}));
