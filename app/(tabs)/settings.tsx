import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  ScrollView,
  Modal,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { User, LogOut, Shield, Bell, HelpCircle, Edit3, Check, X, Moon, Sun, Key, MessageCircle, Users, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/store/authStore';
import { unsubscribeAll } from '@/lib/realtime';
import { api } from '@/lib/api';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, userId, signOut, updateProfile, theme, setTheme } = useAuthStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const { width } = useWindowDimensions();
  const isWideScreen = Platform.OS === 'web' && width > 768;

  // Help Center Modal State
  const [isHelpModalVisible, setIsHelpModalVisible] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [isSendingSupport, setIsSendingSupport] = useState(false);

  const handleUpdateName = async () => {
    if (!displayName.trim()) {
      setDisplayName(user?.display_name || '');
      setIsEditingName(false);
      return;
    }
    try {
      await updateProfile({ display_name: displayName.trim() });
      setIsEditingName(false);
    } catch (err) {
      Alert.alert('Error', 'Failed to update name');
      setDisplayName(user?.display_name || '');
    }
  };

  const handleUpdateAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const formData = new FormData();
        const filename = asset.fileName || asset.uri.split('/').pop() || 'avatar.jpg';

        if (Platform.OS === 'web') {
          const res = await fetch(asset.uri);
          const blob = await res.blob();
          formData.append('file', blob, filename);
        } else {
          formData.append('file', {
            uri: Platform.OS === 'ios' ? asset.uri.replace('file://', '') : asset.uri,
            name: filename,
            type: asset.mimeType || 'image/jpeg',
          } as any);
        }

        const uploadRes = await api.upload<{ url: string }>('/api/upload', formData);

        if (uploadRes.url) {
          await updateProfile({ avatar_url: uploadRes.url });
          Alert.alert('Success', 'Profile picture updated successfully!');
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update profile picture');
    }
  };

  const handleSignOut = async () => {
    const confirmed =
      Platform.OS === 'web'
        ? window.confirm('Sign out? Make sure you have your Account ID saved.')
        : await new Promise<boolean>((resolve) =>
            Alert.alert(
              'Sign Out',
              'Are you sure you want to sign out? Make sure you have your account ID saved.',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Sign Out', style: 'destructive', onPress: () => resolve(true) },
              ]
            )
          );

    if (!confirmed) return;
    await unsubscribeAll();
    await signOut();
  };

  const handleCopyId = async () => {
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(userId || '');
    Alert.alert('Copied', 'Account ID copied to clipboard');
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleSendSupport = async () => {
    if (!supportMessage.trim()) return;
    try {
      setIsSendingSupport(true);
      await api.post('/api/users/support', { message: supportMessage.trim() });
      Alert.alert('Sent', 'Your message has been sent to the admin team.');
      setIsHelpModalVisible(false);
      setSupportMessage('');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send message');
    } finally {
      setIsSendingSupport(false);
    }
  };

  // Dynamic Styles based on theme
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#111B21' : '#F0F2F5';
  const headerBgColor = isDark ? '#202C33' : '#FFFFFF';
  const cardBg = isDark ? '#111B21' : '#FFFFFF';
  const textColor = isDark ? '#E9EDEF' : '#111B21';
  const subTextColor = isDark ? '#8696A0' : '#54656F';
  const borderColor = isDark ? '#222E35' : '#E9EDEF';
  const iconColor = isDark ? '#8696A0' : '#54656F';
  const brandColor = isDark ? '#00A884' : '#25D366';

  if (!userId) {
    return <Redirect href="/auth" />;
  }

  const settingsContent = (
    <ScrollView style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { backgroundColor: headerBgColor }]}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Settings</Text>
      </View>

      <View style={[styles.profileSection, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
        <TouchableOpacity style={styles.avatarContainer} onPress={handleUpdateAvatar}>
          {user?.avatar_url ? (
            Platform.OS === 'web' ? (
              <img src={user.avatar_url} style={{ width: 80, height: 80, borderRadius: 40, objectFit: 'cover' }} alt="Avatar" />
            ) : (
              <Image source={{ uri: user.avatar_url }} style={styles.avatar} />
            )
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]}>
              <User size={40} color={isDark ? '#E9EDEF' : '#4B5563'} />
            </View>
          )}
          <View style={[styles.avatarEditIcon, { backgroundColor: brandColor }]}>
            <Camera size={14} color="white" />
          </View>
        </TouchableOpacity>

        <View style={styles.profileInfo}>
          {isEditingName ? (
            <View style={styles.editContainer}>
              <TextInput
                style={[styles.editInput, { color: textColor }]}
                value={displayName}
                onChangeText={setDisplayName}
                autoFocus
                maxLength={30}
              />
              <TouchableOpacity style={styles.editButton} onPress={handleUpdateName}>
                <Check size={20} color="#10B981" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
                  setIsEditingName(false);
                  setDisplayName(user?.display_name || '');
                }}
              >
                <X size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.nameRow} onPress={() => setIsEditingName(true)}>
              <Text style={[styles.userName, { color: textColor }]}>{user?.display_name}</Text>
              <Edit3 size={16} color={subTextColor} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.idRow} onPress={handleCopyId}>
            <Text style={[styles.userIdLabel, { color: subTextColor }]}>Account ID: </Text>
            <Text style={styles.userId}>{userId}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.settingsList, { backgroundColor: cardBg }]}>
        <TouchableOpacity style={styles.optionRow} onPress={() => router.push('/settings/account')}>
          <Key size={24} color={iconColor} />
          <View style={styles.optionContent}>
            <Text style={[styles.optionLabel, { color: textColor }]}>Account</Text>
            <Text style={[styles.optionHint, { color: subTextColor }]}>Security notifications, change number</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionRow} onPress={() => router.push('/settings/privacy')}>
          <Shield size={24} color={iconColor} />
          <View style={styles.optionContent}>
            <Text style={[styles.optionLabel, { color: textColor }]}>Privacy</Text>
            <Text style={[styles.optionHint, { color: subTextColor }]}>Block contacts, disappearing messages</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionRow} onPress={() => router.push('/settings/chats')}>
          <MessageCircle size={24} color={iconColor} />
          <View style={styles.optionContent}>
            <Text style={[styles.optionLabel, { color: textColor }]}>Chats</Text>
            <Text style={[styles.optionHint, { color: subTextColor }]}>Theme, wallpapers, chat history</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionRow} onPress={toggleTheme}>
          {isDark ? <Sun size={24} color={iconColor} /> : <Moon size={24} color={iconColor} />}
          <View style={styles.optionContent}>
            <Text style={[styles.optionLabel, { color: textColor }]}>Theme</Text>
            <Text style={[styles.optionHint, { color: subTextColor }]}>{isDark ? 'Dark mode' : 'Light mode'} (Tap to toggle)</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionRow} onPress={() => router.push('/settings/notifications')}>
          <Bell size={24} color={iconColor} />
          <View style={styles.optionContent}>
            <Text style={[styles.optionLabel, { color: textColor }]}>Notifications</Text>
            <Text style={[styles.optionHint, { color: subTextColor }]}>Message, group & call tones</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionRow} onPress={() => setIsHelpModalVisible(true)}>
          <HelpCircle size={24} color={iconColor} />
          <View style={styles.optionContent}>
            <Text style={[styles.optionLabel, { color: textColor }]}>Help</Text>
            <Text style={[styles.optionHint, { color: subTextColor }]}>Help center, contact us, privacy policy</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionRow} onPress={() => router.push('/settings/invite')}>
          <Users size={24} color={iconColor} />
          <View style={styles.optionContent}>
            <Text style={[styles.optionLabel, { color: textColor }]}>Invite a friend</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionRow} onPress={handleSignOut}>
          <LogOut size={24} color="#EF4444" />
          <View style={styles.optionContent}>
            <Text style={[styles.optionLabel, { color: '#EF4444' }]}>Log out</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={[styles.version, { color: subTextColor }]}>ApexConnect</Text>

      {/* Help Center Modal */}
      <Modal visible={isHelpModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Help Center</Text>
              <TouchableOpacity onPress={() => setIsHelpModalVisible(false)}>
                <X size={24} color={subTextColor} />
              </TouchableOpacity>
            </View>

            <View style={styles.helpMetaContainer}>
              <Text style={[styles.helpMetaText, { color: subTextColor }]}>Name: {user?.display_name}</Text>
              <Text style={[styles.helpMetaText, { color: subTextColor }]}>ID: {userId}</Text>
              <Text style={[styles.helpMetaText, { color: subTextColor }]}>Time: {new Date().toLocaleString()}</Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: textColor }]}>How can we help you?</Text>
              <TextInput
                style={[styles.textArea, { color: textColor, borderColor }]}
                value={supportMessage}
                onChangeText={setSupportMessage}
                placeholder="Describe your issue here..."
                placeholderTextColor={subTextColor}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity 
              style={[styles.saveButton, !supportMessage.trim() && { opacity: 0.5 }]} 
              onPress={handleSendSupport}
              disabled={isSendingSupport || !supportMessage.trim()}
            >
              <Text style={styles.saveButtonText}>
                {isSendingSupport ? 'Sending...' : 'Send Message'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );

  if (isWideScreen) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: bgColor }}>
        <View style={{ width: 400, borderRightWidth: 1, borderRightColor: borderColor }}>
          {settingsContent}
        </View>
        <View style={{ flex: 1, backgroundColor: isDark ? '#222E35' : '#F0F2F5', justifyContent: 'center', alignItems: 'center' }}>
          {Platform.OS === 'web' ? (
            <img 
              src={((require('../../WhatsApp Image 2026-06-25 at 1.01.58 AM.jpeg') as any).uri) || require('../../WhatsApp Image 2026-06-25 at 1.01.58 AM.jpeg')} 
              style={{ width: 80, height: 80, borderRadius: 16, marginBottom: 16, objectFit: 'contain' }} 
              alt="Logo"
            />
          ) : (
            <Image source={require('../../WhatsApp Image 2026-06-25 at 1.01.58 AM.jpeg')} style={{ width: 80, height: 80, borderRadius: 16, marginBottom: 16 }} />
          )}
          <Text style={{ color: textColor, fontSize: 24, fontWeight: '300' }}>ApexConnect Settings</Text>
          <Text style={{ color: subTextColor, marginTop: 8 }}>Customize your experience</Text>
        </View>
      </View>
    );
  }

  return settingsContent;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  profileSection: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 22,
    fontWeight: '600',
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  userIdLabel: {
    fontSize: 14,
  },
  userId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    letterSpacing: 1,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    padding: 0,
    borderBottomWidth: 2,
    borderBottomColor: '#3B82F6',
  },
  editButton: {
    padding: 8,
  },
  settingsList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    paddingVertical: 8,
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
    marginTop: 2,
  },
  version: {
    textAlign: 'center',
    fontSize: 14,
    marginTop: 40,
    marginBottom: 40,
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  helpMetaContainer: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
  },
  helpMetaText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 150,
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
