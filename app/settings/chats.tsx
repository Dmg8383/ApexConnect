import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Image as ImageIcon, Download, Trash2, Globe, Send, MessageCircle } from 'lucide-react-native';
import { useAuthStore } from '@/store/authStore';
import { useMessagesStore } from '@/store/messagesStore';

export default function ChatsSettingsScreen() {
  const router = useRouter();
  const { theme } = useAuthStore();
  const { clearAllMessages } = useMessagesStore();
  const isDark = theme === 'dark';

  const [enterIsSend, setEnterIsSend] = useState(false);
  const [mediaVisibility, setMediaVisibility] = useState(true);
  const [isClearing, setIsClearing] = useState(false);

  const bgColor = isDark ? '#111B21' : '#F0F2F5';
  const headerBg = isDark ? '#202C33' : '#008069';
  const cardBg = isDark ? '#111B21' : '#FFFFFF';
  const textColor = isDark ? '#E9EDEF' : '#111B21';
  const subTextColor = isDark ? '#8696A0' : '#54656F';
  const iconColor = isDark ? '#8696A0' : '#54656F';
  const borderColor = isDark ? '#222E35' : '#E9EDEF';

  const handleClearAllChats = () => {
    Alert.alert(
      'Clear All Chats',
      'Are you sure you want to permanently delete all your messages? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setIsClearing(true);
            try {
              await clearAllMessages();
              Alert.alert('Done', 'All your chat messages have been cleared.');
            } catch (e) {
              Alert.alert('Error', 'Failed to clear chats. Please try again.');
            } finally {
              setIsClearing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { backgroundColor: headerBg }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chats</Text>
      </View>

      <ScrollView>
        <Text style={[styles.sectionTitle, { color: subTextColor }]}>Display</Text>

        <View style={[styles.section, { backgroundColor: cardBg, borderBottomColor: borderColor, borderTopColor: borderColor }]}>
          <TouchableOpacity style={styles.optionRow}>
            <ImageIcon size={24} color={iconColor} />
            <View style={styles.optionContent}>
              <Text style={[styles.optionLabel, { color: textColor }]}>Wallpaper</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionTitle, { color: subTextColor }]}>Chat settings</Text>

        <View style={[styles.section, { backgroundColor: cardBg, borderBottomColor: borderColor, borderTopColor: borderColor }]}>
          <View style={styles.optionRow}>
            <Send size={24} color={iconColor} />
            <View style={styles.optionContent}>
              <Text style={[styles.optionLabel, { color: textColor }]}>Enter is send</Text>
              <Text style={[styles.optionHint, { color: subTextColor }]}>
                Enter key will send your message
              </Text>
            </View>
            <Switch
              value={enterIsSend}
              onValueChange={setEnterIsSend}
              trackColor={{ false: '#767577', true: '#00A884' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.optionRow}>
            <Download size={24} color={iconColor} />
            <View style={styles.optionContent}>
              <Text style={[styles.optionLabel, { color: textColor }]}>Media visibility</Text>
              <Text style={[styles.optionHint, { color: subTextColor }]}>
                Show newly downloaded media in your device's gallery
              </Text>
            </View>
            <Switch
              value={mediaVisibility}
              onValueChange={setMediaVisibility}
              trackColor={{ false: '#767577', true: '#00A884' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: cardBg, borderBottomColor: borderColor, borderTopColor: borderColor, marginTop: 32 }]}>
          <TouchableOpacity style={styles.optionRow}>
            <Globe size={24} color={iconColor} />
            <View style={styles.optionContent}>
              <Text style={[styles.optionLabel, { color: textColor }]}>App language</Text>
              <Text style={[styles.optionHint, { color: subTextColor }]}>English (device's language)</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: cardBg, borderBottomColor: borderColor, borderTopColor: borderColor, marginTop: 32, marginBottom: 40 }]}>
          <TouchableOpacity style={styles.optionRow}>
            <MessageCircle size={24} color={iconColor} />
            <View style={styles.optionContent}>
              <Text style={[styles.optionLabel, { color: textColor }]}>Chat backup</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionRow} onPress={handleClearAllChats} disabled={isClearing}>
            {isClearing ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Trash2 size={24} color="#EF4444" />
            )}
            <View style={styles.optionContent}>
              <Text style={[styles.optionLabel, { color: '#EF4444' }]}>
                {isClearing ? 'Clearing...' : 'Clear all chats'}
              </Text>
              <Text style={[styles.optionHint, { color: subTextColor }]}>
                Permanently delete all your messages
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    color: 'white',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 24,
    textTransform: 'uppercase',
  },
  section: {
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    gap: 24,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: '400',
  },
  optionHint: {
    fontSize: 14,
    marginTop: 4,
  },
});
