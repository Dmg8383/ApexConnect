import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useWindowDimensions, Image } from 'react-native';
import { useAuthStore } from '@/store/authStore';
import { useCallsHistoryStore, CallLog } from '@/store/callsHistoryStore';
import { FlashList } from '@shopify/flash-list';
import { Phone, PhoneMissed, PhoneOutgoing, PhoneIncoming, Video, Link as LinkIcon, User, Play } from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';

export default function CallsScreen() {
  const { userId, theme } = useAuthStore();
  const isDark = theme === 'dark';
  
  const { calls, isLoading, fetchCalls } = useCallsHistoryStore();

  const { width } = useWindowDimensions();
  const isWideScreen = Platform.OS === 'web' && width > 768;

  const bgColor = isDark ? '#111B21' : '#FFFFFF';
  const cardBgColor = isDark ? '#111B21' : '#FFFFFF';
  const textColor = isDark ? '#E9EDEF' : '#111B21';
  const subTextColor = isDark ? '#8696A0' : '#54656F';
  const borderColor = isDark ? '#222E35' : '#E9EDEF';
  const brandColor = isDark ? '#00A884' : '#25D366';
  const dangerColor = '#EF4444';

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        fetchCalls(userId);
      }
    }, [userId])
  );

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (days === 1) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  const renderCallIcon = (item: CallLog) => {
    const isOutgoing = item.caller_id === userId;
    const isMissed = item.status === 'missed' || item.status === 'rejected';

    if (isMissed) {
      return <PhoneMissed size={16} color={dangerColor} />;
    }
    if (isOutgoing) {
      return <PhoneOutgoing size={16} color={brandColor} />;
    }
    return <PhoneIncoming size={16} color={brandColor} />;
  };

  const renderItem = ({ item }: { item: CallLog }) => {
    const isOutgoing = item.caller_id === userId;
    const otherName = isOutgoing ? item.receiver_name : item.caller_name;
    const otherAvatar = isOutgoing ? item.receiver_avatar : item.caller_avatar;
    const isMissed = item.status === 'missed' || item.status === 'rejected';

    return (
      <View style={[styles.callItem, { borderBottomColor: borderColor }]}>
        <View style={styles.avatarContainer}>
          {otherAvatar ? (
            <Image source={{ uri: otherAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]}>
              <User size={24} color={isDark ? '#E9EDEF' : '#4B5563'} />
            </View>
          )}
        </View>

        <View style={styles.callContent}>
          <Text style={[styles.nameText, { color: isMissed ? dangerColor : textColor }]} numberOfLines={1}>
            {otherName || 'Unknown'}
          </Text>
          <View style={styles.callDetails}>
            {renderCallIcon(item)}
            <Text style={[styles.timeText, { color: subTextColor }]}>
              {formatTime(item.created_at)}
            </Text>
          </View>
        </View>

        <View style={styles.actionContainer}>
          {item.recording_url && (
            <TouchableOpacity 
              style={[styles.actionButton, { marginRight: 8 }]} 
              onPress={() => {
                const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3002';
                Linking.openURL(`${API_URL}${item.recording_url}`);
              }}
            >
              <Play size={20} color={brandColor} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionButton}>
            {item.type === 'video' ? (
              <Video size={24} color={brandColor} />
            ) : (
              <Phone size={24} color={brandColor} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const callsContent = (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { backgroundColor: isDark ? '#202C33' : '#FFFFFF', borderBottomColor: borderColor }]}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Calls</Text>
      </View>
      
      {/* Create call link */}
      <TouchableOpacity style={[styles.createLinkBtn, { borderBottomColor: borderColor }]}>
        <View style={[styles.linkIconContainer, { backgroundColor: brandColor }]}>
          <LinkIcon size={20} color="white" />
        </View>
        <View style={styles.callContent}>
          <Text style={[styles.nameText, { color: textColor }]}>Create call link</Text>
          <Text style={[styles.timeText, { color: subTextColor }]}>Share a link for your WhatsApp call</Text>
        </View>
      </TouchableOpacity>

      <Text style={[styles.recentText, { color: subTextColor }]}>Recent</Text>

      {calls.length === 0 && !isLoading ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: subTextColor }]}>
            No recent calls
          </Text>
        </View>
      ) : (
        <FlashList
          data={calls}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          estimatedItemSize={76}
        />
      )}
    </View>
  );

  if (isWideScreen) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: bgColor }}>
        <View style={{ width: 400, borderRightWidth: 1, borderRightColor: borderColor }}>
          {callsContent}
        </View>
        <View style={[styles.placeholderContainer, { backgroundColor: isDark ? '#222E35' : '#F0F2F5' }]}>
           <Text style={[styles.placeholderText, { color: subTextColor }]}>
             Select a call from the list to see details or start a new call.
           </Text>
        </View>
      </View>
    );
  }

  return callsContent;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  createLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  linkIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  recentText: {
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callContent: {
    flex: 1,
    justifyContent: 'center',
  },
  nameText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  callDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 14,
  },
  actionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
  },
});
