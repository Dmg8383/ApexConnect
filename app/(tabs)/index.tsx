import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  Platform,
  useWindowDimensions,
  useColorScheme,
} from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { getMediaUrl } from '@/lib/media';
import { FlashList } from '@shopify/flash-list';
import { MessageCircle, Search, Circle, Camera, MoreVertical, CheckCheck, Check } from 'lucide-react-native';
import { useMessagesStore } from '@/store/messagesStore';
import { useAuthStore } from '@/store/authStore';
import { usePresenceStore } from '@/store/presenceStore';
import { ConversationWithDetails } from '@/types/database';
import { subscribeToConversations, unsubscribeAll } from '@/lib/realtime';
import { offlineSyncService } from '@/lib/offline';
import { ChatRoom } from '../chat/[id]';

export default function ChatsScreen() {
  const router = useRouter();
  const { userId, user, theme } = useAuthStore();
  const systemTheme = useColorScheme() ?? 'light';
  const isDark = (theme === 'system' ? systemTheme : theme) === 'dark';

  // Premium Dark Mode Colors
  const bgColor = isDark ? '#18181B' : '#FFFFFF';
  const headerBgColor = isDark ? '#18181B' : '#FFFFFF';
  const cardBgColor = 'transparent';
  const textColor = isDark ? '#FAFAFA' : '#111B21';
  const subTextColor = isDark ? '#A1A1AA' : '#54656F';
  const borderColor = isDark ? 'rgba(255,255,255,0.05)' : '#E9EDEF';
  const searchBgColor = isDark ? 'rgba(255,255,255,0.05)' : '#F0F2F5';
  const brandColor = '#10B981';
  const fabBgColor = '#10B981';
  const activeChatBg = isDark ? 'rgba(255,255,255,0.08)' : '#F0F2F5';
  const {
    conversations,
    isLoading,
    loadConversations,
  } = useMessagesStore();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const { width } = useWindowDimensions();
  const isWideScreen = Platform.OS === 'web' && width > 768;

  const presence = usePresenceStore((state) => state.presence);
  const fetchPresence = usePresenceStore((state) => state.fetchPresence);

  // All hooks must be declared before any early returns (React rules of hooks)
  useEffect(() => {
    if (!userId) return;
    offlineSyncService.init();
    loadConversations();
    subscribeToConversations(userId);

    return () => {
      unsubscribeAll();
      offlineSyncService.destroy();
    };
  }, [userId]);

  useEffect(() => {
    if (conversations.length > 0 && userId) {
      const otherUserIds = conversations
        .filter(c => c.type === 'direct')
        .map(c => c.participants.find(p => p.id !== userId)?.id)
        .filter(Boolean) as string[];

      if (otherUserIds.length > 0) {
        fetchPresence(otherUserIds);
      }
    }
  }, [conversations.length, userId]);

  useFocusEffect(
    useCallback(() => {
      if (userId) loadConversations();
    }, [userId])
  );

  // Declarative auth redirect — must come after hooks to obey Rules of Hooks.
  // <Redirect> renders null + triggers navigation imperatively during render,
  // which is safe because it doesn't call router.replace() in an effect.
  if (!userId) {
    return <Redirect href="/auth" />;
  }

  if (user?.is_admin) {
    return <Redirect href="/(tabs)/admin" />;
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getConversationName = (conv: ConversationWithDetails) => {
    if (conv.name) return conv.name;
    if (conv.type === 'direct') {
      const other = conv.participants.find(p => p.id !== userId);
      return other?.display_name || 'Unknown';
    }
    return 'Group';
  };

  const getConversationAvatar = (conv: ConversationWithDetails) => {
    if (conv.type === 'direct') {
      const other = conv.participants.find(p => p.id !== userId);
      const url = getMediaUrl(other?.avatar_url);
      if (url) return { uri: url };
    }
    return null;
  };

  const filteredConversations = conversations.filter(conv => {
    const name = getConversationName(conv).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const renderConversation = ({ item }: { item: ConversationWithDetails }) => {
    const name = getConversationName(item);
    const avatar = getConversationAvatar(item);
    const lastMessage = item.last_message;
    const isTyping = false;

    const otherUserId = item.type === 'direct' ? item.participants.find(p => p.id !== userId)?.id : null;
    const isOnline = otherUserId ? presence[otherUserId] === 'online' : false;

    return (
      <TouchableOpacity
        style={[styles.conversationItem, { backgroundColor: item.id === activeChatId && isWideScreen ? activeChatBg : cardBgColor, borderBottomColor: borderColor }]}
        onPress={() => {
          if (isWideScreen) {
            setActiveChatId(item.id);
          } else {
            router.push(`/chat/${item.id}`);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {avatar ? (
            Platform.OS === 'web' ? (
              <img src={typeof avatar === 'object' ? (avatar as any).uri : avatar} style={{ width: 48, height: 48, borderRadius: 24, objectFit: 'cover' }} alt="Avatar" />
            ) : (
              <Image source={avatar} style={styles.avatar} />
            )
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {isOnline && (
            <View style={[styles.onlineDot, { backgroundColor: '#25D366', borderColor: cardBgColor, borderWidth: 2, width: 14, height: 14, borderRadius: 7 }]} />
          )}
        </View>

        <View style={[styles.conversationContent, { borderBottomColor: borderColor }]}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.conversationName, { color: textColor }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.timestamp, { color: item.unread_count > 0 ? brandColor : subTextColor }]}>
              {lastMessage ? formatTimestamp(lastMessage.created_at) : ''}
            </Text>
          </View>

          <View style={styles.conversationFooter}>
            {isTyping ? (
              <Text style={[styles.typingText, { color: brandColor }]}>Typing...</Text>
            ) : (
              <View style={styles.messagePreviewRow}>
                {lastMessage?.sender_id === userId && (
                  <View style={{ marginRight: 4 }}>
                    {lastMessage.status === 'read' ? (
                      <CheckCheck size={16} color="#53BDEB" />
                    ) : lastMessage.status === 'delivered' ? (
                      <CheckCheck size={16} color={subTextColor} />
                    ) : (
                      <Check size={16} color={subTextColor} />
                    )}
                  </View>
                )}
                <Text style={[styles.lastMessage, { color: subTextColor }]} numberOfLines={1}>
                  {lastMessage?.message_type === 'text'
                    ? lastMessage.content
                    : lastMessage?.message_type === 'image'
                      ? '📷 Photo'
                      : lastMessage?.message_type === 'video'
                        ? '🎬 Video'
                        : lastMessage?.message_type === 'audio'
                          ? '🎵 Audio'
                          : lastMessage?.message_type === 'document'
                            ? '📄 Document'
                            : 'No messages yet'}
                </Text>
              </View>
            )}

            {item.unread_count > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: brandColor }]}>
                <Text style={styles.unreadText}>
                  {item.unread_count > 99 ? '99+' : item.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const ListEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <MessageCircle size={64} color={subTextColor} />
      <Text style={[styles.emptyTitle, { color: textColor }]}>No conversations yet</Text>
      <Text style={[styles.emptySubtitle, { color: subTextColor }]}>
        Start a new chat by tapping the + button
      </Text>
    </View>
  );
  const listContent = (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { backgroundColor: headerBgColor }]}>
        <View style={styles.headerTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 8 }}>
            <Text style={[styles.headerTitle, { color: brandColor }]}>ApexConnect</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity style={styles.iconButton}>
              <Camera size={24} color={textColor} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Search size={24} color={textColor} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <MoreVertical size={24} color={textColor} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={[styles.searchWrapper, { backgroundColor: headerBgColor }]}>
        <View style={[styles.searchContainer, { backgroundColor: searchBgColor, borderColor, borderWidth: 1 }]}>
          <Search size={18} color={subTextColor} />
          <Text style={[styles.searchPlaceholder, { color: subTextColor }]}>Search chats</Text>
        </View>
      </View>

      <FlashList
        data={filteredConversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        estimatedItemSize={76}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
          />
        }
        ListEmptyComponent={ListEmptyComponent}
        contentContainerStyle={styles.listContent}
      />

      <View style={[styles.connectionStatus, { backgroundColor: headerBgColor }]}>
        <Circle
          size={8}
          color={offlineSyncService.isConnected() ? '#10B981' : '#EF4444'}
          fill={offlineSyncService.isConnected() ? '#10B981' : '#EF4444'}
        />
        <Text style={[styles.connectionText, { color: subTextColor }]}>
          {offlineSyncService.isConnected() ? 'Online' : 'Offline'}
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: fabBgColor }]}
        onPress={() => router.push('/new-chat')}
        activeOpacity={0.8}
      >
        <MessageCircle size={28} color="white" />
      </TouchableOpacity>
    </View>
  );

  if (isWideScreen) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: isDark ? '#09090B' : '#FFFFFF' }}>
        <View style={{ width: 350, backgroundColor: bgColor, borderRightWidth: 1, borderRightColor: borderColor }}>
          {listContent}
        </View>
        <View style={{ flex: 1, backgroundColor: isDark ? '#111113' : '#F0F2F5' }}>
          {activeChatId ? (
            <ChatRoom conversationId={activeChatId} />
          ) : (
            <View style={{ flex: 1, backgroundColor: isDark ? '#111113' : '#F0F2F5', justifyContent: 'center', alignItems: 'center' }}>
              {Platform.OS === 'web' ? (
                <div style={{ width: 80, height: 80, marginBottom: 16, overflow: 'hidden', opacity: 0.5, borderRadius: 16 }}>
                  <img src={((require('../../Gemini_Generated_Image_g4ldb2g4ldb2g4ld-removebg-preview.png') as any).uri) || require('../../Gemini_Generated_Image_g4ldb2g4ldb2g4ld-removebg-preview.png')} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Logo" />
                </div>
              ) : (
                <View style={{ width: 80, height: 80, marginBottom: 16, overflow: 'hidden', opacity: 0.5, borderRadius: 16 }}>
                  <Image source={require('../../Gemini_Generated_Image_g4ldb2g4ldb2g4ld-removebg-preview.png')} style={{ width: '100%', height: '100%', resizeMode: 'contain' }} />
                </View>
              )}
              <Text style={{ color: textColor, fontSize: 24, fontWeight: '600', fontFamily: 'Inter, system-ui, sans-serif' }}>ApexConnect for Web</Text>
              <Text style={{ color: subTextColor, marginTop: 8, fontFamily: 'Inter, system-ui, sans-serif' }}>Select a chat to start messaging</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  return listContent;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    padding: 4,
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999, // Pill shaped
    paddingHorizontal: 16,
    height: 44, // Slightly taller
  },
  searchPlaceholder: {
    marginLeft: 12,
    fontSize: 15,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 76,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '600',
    color: 'white',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  conversationContent: {
    flex: 1,
    justifyContent: 'center',
    height: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  timestamp: {
    fontSize: 12,
    marginLeft: 8,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messagePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  lastMessage: {
    fontSize: 14,
    flex: 1,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  typingText: {
    fontSize: 14,
    fontStyle: 'italic',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  unreadBadge: {
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'white',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    gap: 6,
  },
  connectionText: {
    fontSize: 12,
    color: '#6B7280',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
