import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
  Alert,
  ActionSheetIOS,
  Image,
  Linking,
  Modal,
  Animated as RNAnimated,
  Keyboard,
  KeyboardEvent,
  useColorScheme,
} from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMediaUrl } from '@/lib/media';

import {
  ArrowLeft,
  Send,
  Paperclip,
  Camera,
  Image as ImageIcon,
  Check,
  CheckCheck,
  MoreVertical,
  Trash2,
  Edit,
  Reply,
  Video,
  Phone,
  Plus,
  Mic,
  FileText,
  Music,
  Download,
  X,
  Smile,
} from 'lucide-react-native';
import { useMessagesStore } from '@/store/messagesStore';
import { useAuthStore } from '@/store/authStore';
import { useCallStore } from '@/store/callStore';
import { usePresenceStore } from '@/store/presenceStore';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { MessageWithStatus, ConversationWithDetails } from '@/types/database';
import { subscribeToConversation, unsubscribeAll } from '@/lib/realtime';
import { offlineSyncService } from '@/lib/offline';
import { playSound } from '@/lib/sounds';

const BOUNCE_DURATION = 150;

function TypingDots() {
  const dot1 = useRef(new RNAnimated.Value(0)).current;
  const dot2 = useRef(new RNAnimated.Value(0)).current;
  const dot3 = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    const bounce = (dot: typeof RNAnimated.Value.prototype, delay: number) => {
      setTimeout(() => {
        RNAnimated.loop(
          RNAnimated.sequence([
            RNAnimated.timing(dot, { toValue: -4, duration: BOUNCE_DURATION, useNativeDriver: true }),
            RNAnimated.timing(dot, { toValue: 0, duration: BOUNCE_DURATION, useNativeDriver: true })
          ])
        ).start();
      }, delay);
    };

    bounce(dot1, 0);
    bounce(dot2, 150);
    bounce(dot3, 300);
  }, []);

  return (
    <View style={styles.typingContainer}>
      <RNAnimated.View style={[styles.typingDot, { transform: [{ translateY: dot1 }] }]} />
      <RNAnimated.View style={[styles.typingDot, { transform: [{ translateY: dot2 }] }]} />
      <RNAnimated.View style={[styles.typingDot, { transform: [{ translateY: dot3 }] }]} />
    </View>
  );
}

export function ChatRoom({ conversationId }: { conversationId: string }) {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const { userId, theme } = useAuthStore();
  const systemTheme = useColorScheme() ?? 'light';
  const isDark = (theme === 'system' ? systemTheme : theme) === 'dark';

  // Authentic WhatsApp Colors
  const bgColor = isDark ? '#0B141A' : '#EFEAE2'; // Chat background
  const headerBgColor = isDark ? '#1F2C34' : '#075E54';
  const headerTextColor = isDark ? '#E9EDEF' : '#FFFFFF';
  const inputBgColor = 'transparent'; // Footer background is transparent over doodle
  const inputFieldBgColor = isDark ? '#2A3942' : '#FFFFFF';
  const textColor = isDark ? '#E9EDEF' : '#111B21';
  const subTextColor = isDark ? '#8696A0' : '#667781';
  const borderColor = isDark ? '#202C33' : '#E9EDEF';
  const replyBgColor = isDark ? '#1D282F' : '#F0F2F5';
  const editBgColor = isDark ? 'rgba(0, 168, 132, 0.1)' : '#FEF3C7';
  
  // WhatsApp Bubble Colors
  const ownMsgBg = isDark ? '#005C4B' : '#D9FDD3';
  const otherMsgBg = isDark ? '#202C33' : '#FFFFFF';
  const brandColor = '#00A884';
  
  const doodleUrl = 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png';

  const {
    messages,
    conversations,
    typingUsers,
    loadMessages,
    sendMessage,
    markAsRead,
    setTyping,
    deleteMessage,
    editMessage,
    subscribeToConversation,
    unsubscribeFromConversation,
    clearConversation,
  } = useMessagesStore();
  
  useEffect(() => {
    if (Platform.OS !== 'web') {
      SystemUI.setBackgroundColorAsync(bgColor);
    }
  }, [bgColor]);
  
  const presence = usePresenceStore((state) => state.presence);
  const fetchPresence = usePresenceStore((state) => state.fetchPresence);

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [editingMessage, setEditingMessage] = useState<MessageWithStatus | null>(null);
  const [replyingTo, setReplyingTo] = useState<MessageWithStatus | null>(null);
  const listRef = useRef<FlashList<any>>(null);
  const inputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const conversation = conversations.find(c => c.id === conversationId) as ConversationWithDetails | undefined;
  const conversationMessages = messages[conversationId] || [];
  const typingUserIds = typingUsers[conversationId] || [];

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e: KeyboardEvent) => {
        setKeyboardVisible(true);
        // Scroll to end when keyboard appears
        if (listRef.current && conversationMessages.length > 0) {
          setTimeout(() => {
            listRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, [conversationMessages.length]);

  useEffect(() => {
    if (conversationId) {
      loadMessages(conversationId);
      markAsRead(conversationId);
      useMessagesStore.getState().setActiveConversationId(conversationId);

      if (userId) {
        subscribeToConversation(conversationId);
      }

      return () => {
        useMessagesStore.getState().setActiveConversationId(null);
        unsubscribeFromConversation(conversationId);
      };
    }
  }, [conversationId, userId]);

  useEffect(() => {
    if (conversation?.type === 'direct') {
      const otherUserId = conversation.participants.find(p => p.id !== userId)?.id;
      if (otherUserId) fetchPresence([otherUserId]);
    }
  }, [conversation?.id, userId]);

  // Instantly mark messages as read if they arrive while the chat is actively open
  useEffect(() => {
    if (conversationId && conversationMessages.length > 0) {
      const hasUnread = conversationMessages.some(m => m.sender_id !== userId && m.status !== 'read');
      if (hasUnread) {
        markAsRead(conversationId);
      }
    }
  }, [conversationMessages.length, conversationId, userId]);

  const handleTyping = () => {
    setTyping(conversationId, true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(conversationId, false);
    }, 3000);
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    setInputText('');
    setIsSending(true);

    if (!offlineSyncService.isConnected()) {
      await offlineSyncService.queueMessage(conversationId, text, 'text');
      setIsSending(false);
      return;
    }

    try {
      if (editingMessage) {
        await editMessage(editingMessage.id, text);
        setEditingMessage(null);
      } else {
        await sendMessage(conversationId, text);
      }

      setTyping(conversationId, false);
      playSound('send');
    } catch (error) {
      playSound('error');
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleMenuPress = () => {
    setShowChatMenu(prev => !prev);
  };

  const handleClearChat = async () => {
    setShowChatMenu(false);
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete all messages in this conversation? This cannot be undone.')) {
        try {
          await clearConversation(conversationId);
          window.alert('Chat has been cleared.');
        } catch (e) {
          window.alert('Failed to clear chat. Please try again.');
        }
      }
    } else {
      Alert.alert(
        'Clear Chat',
        'Are you sure you want to delete all messages in this conversation? This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear',
            style: 'destructive',
            onPress: async () => {
              try {
                await clearConversation(conversationId);
                Alert.alert('Done', 'Chat has been cleared.');
              } catch (e) {
                Alert.alert('Error', 'Failed to clear chat. Please try again.');
              }
            },
          },
        ]
      );
    }
  };

  const uploadFile = async (asset: any, type: 'image' | 'video' | 'audio' | 'document') => {
    try {
      setIsSending(true);
      const formData = new FormData();
      
      const filename = asset.fileName || asset.name || asset.uri.split('/').pop() || `upload.${type === 'video' ? 'mp4' : 'jpg'}`;
      const mimeType = asset.mimeType || 'application/octet-stream';

      if (Platform.OS === 'web') {
        if (asset.file) {
          formData.append('file', asset.file);
        } else {
          const res = await fetch(asset.uri);
          const blob = await res.blob();
          formData.append('file', blob, filename);
        }
      } else {
        formData.append('file', {
          uri: Platform.OS === 'ios' ? asset.uri.replace('file://', '') : asset.uri,
          name: filename,
          type: mimeType,
        } as any);
      }

      // Upload to our new backend route
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      
      const data = await response.json();
      
      // Send the message, passing the filename as content and the mediaUrl
      await sendMessage(conversationId, filename, type, data.url);
      playSound('send');
      
    } catch (error) {
      console.error('Upload error:', error);
      playSound('error');
      if (Platform.OS === 'web') {
        window.alert('Failed to upload the file.');
      } else {
        Alert.alert('Upload Error', 'Failed to upload the file.');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleAttachMedia = () => {
    setShowAttachMenu(!showAttachMenu);
  };

  const handleDownload = (url: string) => {
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = url;
      a.download = url.split('/').pop() || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      Linking.openURL(url);
    }
  };

  const pickImage = async (source: 'camera' | 'library') => {
    setShowAttachMenu(false);
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    };
    
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const type = asset.type === 'video' ? 'video' : 'image';
      await uploadFile(asset, type);
    }
  };

  const pickDocument = async (type: 'document' | 'audio') => {
    setShowAttachMenu(false);
    const result = await DocumentPicker.getDocumentAsync({
      type: type === 'audio' ? 'audio/*' : '*/*',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await uploadFile(asset, type);
    }
  };

  const handleLongPress = (message: MessageWithStatus) => {
    if (message.sender_id === userId) {
      const options = ['Edit', 'Delete', 'Reply', 'Cancel'];
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options,
            cancelButtonIndex: 3,
            destructiveButtonIndex: 1,
          },
          (buttonIndex) => {
            if (buttonIndex === 0) {
              setEditingMessage(message);
              setInputText(message.content || '');
              inputRef.current?.focus();
            } else if (buttonIndex === 1) {
              Alert.alert('Delete Message', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => deleteMessage(message.id),
                },
              ]);
            } else if (buttonIndex === 2) {
              setReplyingTo(message);
            }
          }
        );
      } else {
        Alert.alert('Message Actions', '', [
          { text: 'Edit', onPress: () => {
            setEditingMessage(message);
            setInputText(message.content || '');
            inputRef.current?.focus();
          }},
          { text: 'Delete', onPress: () => deleteMessage(message.id), style: 'destructive' },
          { text: 'Reply', onPress: () => setReplyingTo(message) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    } else {
      setReplyingTo(message);
    }
  };

  const getConversationName = () => {
    if (!conversation) return 'Chat';
    if (conversation.name) return conversation.name;
    if (conversation.type === 'direct') {
      const other = conversation.participants.find(p => p.id !== userId);
      return other?.display_name || 'Unknown';
    }
    return 'Group';
  };

  const renderMessage = ({ item }: { item: MessageWithStatus }) => {
    if (item.content?.startsWith('[SYSTEM]')) {
      return (
        <View style={styles.systemMessageContainer}>
          <View style={[styles.systemMessageBubble, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
            <Text style={[styles.systemMessageText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              {item.content.replace('[SYSTEM]', '').trim()}
            </Text>
          </View>
        </View>
      );
    }

    const isOwn = item.sender_id === userId;
    const showStatus = isOwn && item.status;

    return (
      <TouchableOpacity
        style={[
          styles.messageBubble,
          isOwn ? [styles.ownMessage, { backgroundColor: ownMsgBg }] : [styles.otherMessage, { backgroundColor: otherMsgBg }],
        ]}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.8}
      >
        {!isOwn && conversation?.type === 'group' && item.sender && (
          <Text style={[styles.senderName, { color: brandColor }]}>
            {item.sender.display_name}
          </Text>
        )}
        {item.reply_to && (
          <View style={styles.replyContainer}>
            <View style={styles.replyLine} />
            <Text style={styles.replyText} numberOfLines={2}>
              {item.content}
            </Text>
          </View>
        )}

        {item.message_type === 'image' && item.media_url && (
          <TouchableOpacity onPress={() => setViewingImage(getMediaUrl(item.media_url)!)} activeOpacity={0.9}>
            <Image source={{ uri: getMediaUrl(item.media_url)! }} style={styles.messageImage} />
          </TouchableOpacity>
        )}
        
        {item.message_type === 'video' && item.media_url && (
          <TouchableOpacity onPress={() => handleDownload(getMediaUrl(item.media_url)!)} activeOpacity={0.9}>
            <View style={[styles.messageImage, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
              <Video size={48} color="white" />
            </View>
          </TouchableOpacity>
        )}

        {item.message_type === 'audio' && item.media_url && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? '#374151' : '#D1D5DB', justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
              <Music size={20} color={textColor} />
            </View>
            <View>
              <Text style={{ color: textColor, fontWeight: '500' }}>Audio Message</Text>
            </View>
            <TouchableOpacity onPress={() => handleDownload(getMediaUrl(item.media_url)!)} style={{ marginLeft: 'auto', paddingLeft: 12 }}>
               <Download size={20} color={brandColor} />
            </TouchableOpacity>
          </View>
        )}

        {item.message_type === 'document' && item.media_url && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4, backgroundColor: isDark ? '#2A3942' : '#F3F4F6', padding: 8, borderRadius: 8 }}>
            <FileText size={32} color={brandColor} style={{ marginRight: 8 }} />
            <Text style={{ color: textColor, flexShrink: 1, marginRight: 8, maxWidth: 150 }} numberOfLines={1}>{item.content || 'Document'}</Text>
            <TouchableOpacity onPress={() => handleDownload(getMediaUrl(item.media_url)!)}>
              <Download size={20} color={subTextColor} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.messageContentWrapper}>
          {item.content && item.message_type === 'text' && (
            <Text style={[styles.messageText, { color: textColor }]}>
              {item.content}
            </Text>
          )}

          <View style={styles.messageFooter}>
            {item.is_edited && (
              <Text style={styles.editedText}>edited</Text>
            )}
            <Text style={[styles.timeText, { color: subTextColor }]}>
              {new Date(item.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>

            {showStatus && (
              <View style={styles.statusIcon}>
                {item.status === 'read' ? (
                  <CheckCheck size={16} color="#53BDEB" />
                ) : item.status === 'delivered' ? (
                  <CheckCheck size={16} color={subTextColor} />
                ) : (
                  <Check size={16} color={subTextColor} />
                )}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTypingIndicator = () => {
    if (typingUserIds.length === 0) return null;

    let typingText = '';
    if (typingUserIds.length === 1) {
      const user = conversation?.participants.find(p => p.id === typingUserIds[0]);
      typingText = `${user?.display_name || 'Someone'} is typing...`;
    } else {
      typingText = `${typingUserIds.length} people are typing...`;
    }

    return (
      <View style={{
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
      }}>
        <View style={{
          backgroundColor: otherMsgBg,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 16,
          borderBottomLeftRadius: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 1,
          elevation: 1,
          borderWidth: 1,
          borderColor: borderColor,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}>
          <TypingDots />
          <Text style={{ fontSize: 12, color: subTextColor, fontStyle: 'italic', fontWeight: '500' }}>
            {typingText}
          </Text>
        </View>
      </View>
    );
  };

  const insets = useSafeAreaInsets();

  const KeyboardWrapper = Platform.OS !== 'web' ? KeyboardAvoidingView : View;
  const keyboardProps = Platform.OS !== 'web' ? { 
    behavior: 'padding' as const,
    keyboardVerticalOffset: 0
  } : {};

  return (
    <KeyboardWrapper
      style={[styles.container, { backgroundColor: bgColor, flexDirection: Platform.OS === 'web' ? 'row' : 'column' }]}
      {...keyboardProps}
    >
      <View style={{ flex: 1, position: 'relative' }}>
        <View style={[styles.header, { backgroundColor: headerBgColor, borderBottomColor: borderColor }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
        >
          <ArrowLeft size={24} color={headerTextColor} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.headerInfo} 
          onPress={() => router.push({ pathname: '/chat/info', params: { id: conversationId } })}
          activeOpacity={0.7}
        >
          {(() => {
            let avatarUrl = null;
            if (conversation?.type === 'direct') {
              const other = conversation.participants.find(p => p.id !== userId);
              avatarUrl = getMediaUrl(other?.avatar_url);
            }
            if (avatarUrl) {
              return (
                <Image 
                  source={{ uri: avatarUrl }} 
                  style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }} 
                />
              );
            }
            return (
              <View style={styles.avatarPlaceholderHeader}>
                <Text style={styles.avatarPlaceholderText}>{getConversationName().charAt(0).toUpperCase()}</Text>
              </View>
            );
          })()}
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, { color: headerTextColor }]} numberOfLines={1}>
              {getConversationName()}
            </Text>
            {(() => {
              if (typingUserIds.length > 0) {
                return <Text style={[styles.onlineText, { color: brandColor }]}>typing...</Text>;
              }
              if (conversation?.type === 'direct') {
                const otherUserId = conversation.participants.find(p => p.id !== userId)?.id;
                const isOnline = otherUserId ? presence[otherUserId] === 'online' : false;
                return isOnline ? (
                  <Text style={[styles.onlineText, { color: brandColor }]}>online</Text>
                ) : (
                  <Text style={[styles.onlineText, { color: subTextColor }]}>offline</Text>
                );
              }
              return (
                <Text style={[styles.onlineText, { color: subTextColor }]}>
                  tap here for group info
                </Text>
              );
            })()}
          </View>
        </TouchableOpacity>

        <View style={styles.headerRightIcons}>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => {
            const targets = conversation?.participants.filter(p => p.id !== userId).map(p => p.id) || [];
            if (targets.length > 0) useCallStore.getState().initiateCall(conversationId, targets, true);
          }}>
            <Video size={24} color={headerTextColor} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => {
            const targets = conversation?.participants.filter(p => p.id !== userId).map(p => p.id) || [];
            if (targets.length > 0) useCallStore.getState().initiateCall(conversationId, targets, false);
          }}>
            <Phone size={22} color={headerTextColor} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton} onPress={handleMenuPress}>
            <MoreVertical size={24} color={headerTextColor} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Dropdown Chat Menu */}
      {showChatMenu && (
        <>
          <TouchableOpacity 
            style={styles.menuOverlay} 
            onPress={() => setShowChatMenu(false)} 
            activeOpacity={1}
          />
          <View style={[styles.chatMenuDropdown, { backgroundColor: isDark ? '#233138' : '#FFFFFF' }]}>
            <TouchableOpacity 
              style={styles.chatMenuItem} 
              onPress={() => {
                setShowChatMenu(false);
                const otherUserId = conversation?.participants.find(p => p.id !== userId)?.id;
                Alert.alert('Contact Info', `Name: ${getConversationName()}\nID: ${otherUserId || 'Unknown'}`, [{ text: 'OK' }]);
              }}
            >
              <Text style={[styles.chatMenuItemText, { color: textColor }]}>Contact info</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.chatMenuItem} onPress={handleClearChat}>
              <Text style={[styles.chatMenuItemText, { color: '#EF4444' }]}>Clear chat</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <ImageBackground 
        source={{ uri: doodleUrl }} 
        style={styles.backgroundImage}
        imageStyle={{ opacity: isDark ? 0.05 : 0.4 }}
      >
        <FlashList
          ref={listRef}
          data={conversationMessages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          estimatedItemSize={60}
          contentContainerStyle={styles.messagesList}
          inverted
        />

      {renderTypingIndicator()}

      {replyingTo && (
        <View style={[styles.replyPreview, { backgroundColor: replyBgColor, borderTopColor: borderColor }]}>
          <View style={styles.replyPreviewContent}>
            <Text style={[styles.replyPreviewLabel, { color: subTextColor }]}>
              Replying to {replyingTo.sender_id === userId ? 'yourself' : getConversationName()}
            </Text>
            <Text style={[styles.replyPreviewText, { color: textColor }]} numberOfLines={1}>
              {replyingTo.content}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyingTo(null)}>
            <Text style={styles.replyPreviewCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {editingMessage && (
        <View style={[styles.editPreview, { backgroundColor: editBgColor, borderTopColor: borderColor }]}>
          <Text style={[styles.editPreviewLabel, { color: isDark ? '#FEF3C7' : '#92400E' }]}>Editing message</Text>
          <TouchableOpacity onPress={() => {
            setEditingMessage(null);
            setInputText('');
          }}>
            <Text style={styles.editPreviewCancel}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[styles.inputWrapper, { backgroundColor: 'transparent' }]}>
        {showAttachMenu && (
          <View style={[styles.attachMenu, { backgroundColor: inputBgColor, borderColor }]}>
            <TouchableOpacity style={styles.attachMenuItem} onPress={() => pickDocument('document')}>
              <View style={[styles.attachMenuIcon, { backgroundColor: '#7F66FF' }]}><FileText size={20} color="white" /></View>
              <Text style={{ color: textColor }}>Document</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachMenuItem} onPress={() => pickImage('camera')}>
              <View style={[styles.attachMenuIcon, { backgroundColor: '#D3396D' }]}><Camera size={20} color="white" /></View>
              <Text style={{ color: textColor }}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachMenuItem} onPress={() => pickImage('library')}>
              <View style={[styles.attachMenuIcon, { backgroundColor: '#007BFF' }]}><ImageIcon size={20} color="white" /></View>
              <Text style={{ color: textColor }}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachMenuItem} onPress={() => pickDocument('audio')}>
              <View style={[styles.attachMenuIcon, { backgroundColor: '#FF7F00' }]}><Music size={20} color="white" /></View>
              <Text style={{ color: textColor }}>Audio</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={[
          styles.inputContainer, 
          { 
            backgroundColor: inputBgColor, 
            paddingBottom: Platform.OS !== 'web' && !keyboardVisible ? Math.max(insets.bottom, 12) : 12 
          }
        ]}>
          <View style={[styles.textInputContainer, { backgroundColor: inputFieldBgColor }]}>
            <TouchableOpacity style={styles.actionButtonInside}>
              <Smile size={24} color={subTextColor} />
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              style={[styles.textInput, { color: textColor }]}
              placeholder="Message"
              placeholderTextColor={subTextColor}
              value={inputText}
              onChangeText={(text) => {
                setInputText(text);
                handleTyping();
              }}
              onKeyPress={(e: any) => {
                // Submit on Enter without Shift (Web only)
                if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter') {
                  if (!e.nativeEvent.shiftKey) {
                    e.preventDefault();
                    if (inputText.trim().length > 0 && !isSending) {
                      handleSend();
                    }
                  }
                }
              }}
              multiline
              maxLength={4000}
            />

            <View style={styles.rightActionsContainer}>
              <TouchableOpacity
                style={styles.actionButtonInside}
                onPress={handleAttachMedia}
              >
                <Paperclip size={22} color={subTextColor} />
              </TouchableOpacity>
              
              {!inputText.trim() && (
                <TouchableOpacity style={styles.actionButtonInside}>
                  <Camera size={22} color={subTextColor} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: brandColor }
            ]}
            onPress={inputText.trim().length > 0 ? handleSend : () => {}}
            disabled={isSending}
            activeOpacity={0.8}
          >
            {inputText.trim().length > 0 ? (
              <Send size={20} color="white" />
            ) : (
              <Mic size={24} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </View>
      </ImageBackground>

      {Platform.OS === 'web' && showSidePanel && (
        <View style={{ width: 320, backgroundColor: headerBgColor, borderLeftWidth: 1, borderLeftColor: borderColor }}>
           <View style={{ padding: 20, alignItems: 'center' }}>
              <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: '#9CA3AF', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                 <Text style={{ fontSize: 48, color: 'white', fontWeight: 'bold' }}>{getConversationName().charAt(0)}</Text>
              </View>
              <Text style={{ fontSize: 24, color: textColor, fontWeight: '500', marginBottom: 8 }}>{getConversationName()}</Text>
              <Text style={{ color: subTextColor, fontSize: 14 }}>User ID:</Text>
              <Text style={{ color: subTextColor, fontSize: 12, marginTop: 4 }}>{conversation?.participants.find(p => p.id !== userId)?.id}</Text>
           </View>
        </View>
      )}

      <Modal visible={!!viewingImage} transparent={true} animationType="fade" onRequestClose={() => setViewingImage(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ position: 'absolute', top: 40, right: 20, flexDirection: 'row', gap: 24, zIndex: 100 }}>
            <TouchableOpacity onPress={() => handleDownload(viewingImage!)} style={{ padding: 8 }}>
              <Download size={28} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setViewingImage(null)} style={{ padding: 8 }}>
              <X size={28} color="white" />
            </TouchableOpacity>
          </View>
          {viewingImage && (
            <Image 
              source={{ uri: viewingImage }} 
              style={{ width: '100%', height: '80%' }} 
              resizeMode="contain" 
            />
          )}
        </View>
      </Modal>
      </View>
    </KeyboardWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  avatarPlaceholderHeader: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarPlaceholderText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  onlineText: {
    fontSize: 13,
    color: '#8696A0',
    marginTop: 1,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  headerRightIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  chatMenuDropdown: {
    position: 'absolute',
    top: 70,
    right: 8,
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 101,
  },
  chatMenuItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  chatMenuItemText: {
    fontSize: 16,
  },
  headerIconButton: {
    padding: 4,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    borderTopRightRadius: 0,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    borderTopLeftRadius: 0,
  },
  messageContentWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    paddingRight: 10,
    paddingBottom: 4,
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginLeft: 'auto',
    marginBottom: 0,
    paddingLeft: 8,
  },
  timeText: {
    fontSize: 11,
  },
  statusIcon: {
    marginLeft: 4,
  },
  editedText: {
    fontSize: 11,
    color: '#8696A0',
    fontStyle: 'italic',
    marginRight: 6,
  },
  replyContainer: {
    flexDirection: 'row',
    paddingLeft: 10,
    marginBottom: 4,
  },
  replyLine: {
    width: 3,
    backgroundColor: '#3B82F6',
    borderRadius: 2,
    marginRight: 8,
  },
  replyText: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9CA3AF',
  },
  typingLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 8,
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  replyPreviewContent: {
    flex: 1,
  },
  replyPreviewLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  replyPreviewText: {
    fontSize: 14,
    color: '#374151',
    marginTop: 2,
  },
  replyPreviewCancel: {
    color: '#EF4444',
    fontWeight: '500',
  },
  editPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  editPreviewLabel: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
  editPreviewCancel: {
    color: '#EF4444',
    fontWeight: '500',
  },
  attachMenu: {
    position: 'absolute',
    bottom: 70,
    left: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    width: 280,
    zIndex: 10,
  },
  attachMenuItem: {
    alignItems: 'center',
    width: 60,
  },
  attachMenuIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 8,
  },
  textInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24, // Matches WhatsApp's rounded input
    minHeight: 48,
    maxHeight: 120,
    overflow: 'hidden',
  },
  actionButtonInside: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  textInput: {
    flex: 1,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
    fontFamily: 'Inter, system-ui, sans-serif',
    // @ts-ignore - Web-only outline removal
    outlineStyle: 'none',
  },
  cameraButtonInside: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  senderName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  systemMessageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    maxWidth: '80%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemMessageText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default function ChatRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChatRoom conversationId={id as string} />;
}
