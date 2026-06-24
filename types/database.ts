export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          avatar_url: string | null;
          public_key: string | null;
          created_at: string;
          updated_at: string;
          last_seen_at: string;
          is_admin?: boolean;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          public_key?: string | null;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          public_key?: string | null;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          type: 'direct' | 'group';
          name: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type?: 'direct' | 'group';
          name?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          type?: 'direct' | 'group';
          name?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversation_participants: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          joined_at: string;
          last_read_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          user_id: string;
          joined_at?: string;
          last_read_at?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          user_id?: string;
          joined_at?: string;
          last_read_at?: string | null;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          content: string | null;
          message_type: 'text' | 'image' | 'video' | 'audio' | 'document';
          media_url: string | null;
          media_encryption_key: string | null;
          reply_to: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
          is_edited: boolean;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content?: string | null;
          message_type?: 'text' | 'image' | 'video' | 'audio' | 'document';
          media_url?: string | null;
          media_encryption_key?: string | null;
          reply_to?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          is_edited?: boolean;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          content?: string | null;
          message_type?: 'text' | 'image' | 'video' | 'audio' | 'document';
          media_url?: string | null;
          media_encryption_key?: string | null;
          reply_to?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
          is_edited?: boolean;
        };
      };
      message_status: {
        Row: {
          id: string;
          message_id: string;
          user_id: string;
          status: 'sent' | 'delivered' | 'read';
          updated_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          user_id: string;
          status?: 'sent' | 'delivered' | 'read';
          updated_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          user_id?: string;
          status?: 'sent' | 'delivered' | 'read';
          updated_at?: string;
        };
      };
      typing_indicators: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          is_typing: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          user_id: string;
          is_typing?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          user_id?: string;
          is_typing?: boolean;
          updated_at?: string;
        };
      };
    };
  };
}

export type User = Database['public']['Tables']['users']['Row'];
export type Conversation = Database['public']['Tables']['conversations']['Row'];
export type ConversationParticipant = Database['public']['Tables']['conversation_participants']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageStatus = Database['public']['Tables']['message_status']['Row'];
export type TypingIndicator = Database['public']['Tables']['typing_indicators']['Row'];

export interface ConversationWithDetails extends Conversation {
  participants: User[];
  last_message?: Message;
  unread_count: number;
}

export interface MessageWithStatus extends Message {
  sender?: User;
  status?: 'sent' | 'delivered' | 'read';
}
