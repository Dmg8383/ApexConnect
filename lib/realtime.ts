/**
 * realtime.ts — compatibility shim
 *
 * The old Supabase Realtime subscriptions have been replaced by Socket.io
 * (see lib/ws.ts and store/messagesStore.ts → subscribeToConversation).
 *
 * This file re-exports no-op functions so existing imports in screens
 * that call subscribeToConversations / unsubscribeAll don't need changing.
 *
 * Real-time updates are now handled per-conversation in messagesStore via
 * the Socket.io new_message / message_updated / message_deleted events.
 */

/**
 * No-op — realtime is handled by Socket.io in messagesStore.
 * Called from the Chats tab; kept for API compatibility.
 */
export const subscribeToConversations = (_userId: string): void => {
  // Socket.io connection is established in authStore.loadUser / createAccount / signIn.
  // Per-conversation subscription happens in messagesStore.subscribeToConversation.
};

/**
 * No-op — Socket.io disconnect is handled by authStore.signOut.
 */
export const unsubscribeAll = async (): Promise<void> => {};

/**
 * No-op — kept for API compatibility with any imports.
 */
export const subscribeToConversation = (
  _conversationId: string,
  _userId: string
): void => {};

/**
 * No-op — presence is not implemented in the PostgreSQL backend.
 */
export const updatePresence = async (
  _conversationId: string,
  _userId: string
): Promise<void> => {};
