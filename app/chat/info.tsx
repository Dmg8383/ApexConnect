import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMessagesStore } from '@/store/messagesStore';
import { useAuthStore } from '@/store/authStore';
import { ArrowLeft, UserPlus, Users, X } from 'lucide-react-native';
import { api } from '@/lib/api';
import { User } from '@/types/database';

export default function GroupInfoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { conversations, addGroupParticipants, removeGroupParticipant, updateParticipantRole, loadConversations } = useMessagesStore();
  const { userId, theme } = useAuthStore();
  const isDark = theme === 'dark';

  const [searchId, setSearchId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionSheetConfig, setActionSheetConfig] = useState<{title: string, options: {text: string, style?: string, onPress: () => void}[]}>({title: '', options: []});

  const showActionSheet = (title: string, options: any[]) => {
    setActionSheetConfig({ title, options });
    setActionSheetVisible(true);
  };

  const conversation = conversations.find(c => c.id === id);

  if (!conversation) {
    return (
      <View style={styles.container}>
        <Text>Conversation not found</Text>
      </View>
    );
  }

  const isGroup = conversation.type === 'group';
  const currentUserRole = conversation.participants.find(p => p.id === userId)?.role;
  const isAdmin = currentUserRole === 'admin';
  const brandColor = '#10B981';

  const handleBack = () => router.back();

  const handleAddParticipant = async () => {
    if (!searchId.trim()) return;
    setIsSearching(true);
    try {
      const data = await api.get<User>(`/api/users/${searchId.trim().toUpperCase()}`);
      if (conversation.participants.some(p => p.id === data.id)) {
        Alert.alert('Info', 'User is already in the group');
        return;
      }
      
      await addGroupParticipants(conversation.id, [data.id]);
      await loadConversations(); // refresh list
      setSearchId('');
      setIsAdding(false);
      Alert.alert('Success', 'Participant added');
    } catch (e) {
      Alert.alert('Error', 'User not found or failed to add');
    } finally {
      setIsSearching(false);
    }
  };

  const handleParticipantAction = (participantId: string, role: string) => {
    if (!isAdmin) return;
    if (participantId === userId) return;

    const options = [
      {
        text: role === 'admin' ? 'Demote to Member' : 'Make Admin',
        onPress: async () => {
          await updateParticipantRole(conversation.id, participantId, role === 'admin' ? 'member' : 'admin');
          loadConversations();
        }
      },
      {
        text: 'Remove from Group',
        style: 'destructive' as const,
        onPress: async () => {
          await removeGroupParticipant(conversation.id, participantId);
          loadConversations();
        }
      },
      { text: 'Cancel', style: 'cancel' as const, onPress: () => setActionSheetVisible(false) }
    ];

    showActionSheet('Manage Participant', options);
  };

  const handleLeaveGroup = () => {
    showActionSheet('Leave Group', [
      { text: 'Cancel', style: 'cancel', onPress: () => setActionSheetVisible(false) },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await removeGroupParticipant(conversation.id, userId as string);
          loadConversations();
          router.replace('/(tabs)');
          setActionSheetVisible(false);
        }
      }
    ]);
  };

  const bgColor = isDark ? '#111113' : '#F0F2F5';
  const cardColor = isDark ? '#18181B' : '#FFFFFF';
  const textColor = isDark ? '#FAFAFA' : '#111827';
  const subTextColor = isDark ? '#A1A1AA' : '#6B7280';
  const borderColor = isDark ? 'rgba(255,255,255,0.05)' : '#E5E7EB';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { backgroundColor: cardColor, borderBottomColor: borderColor }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={24} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>
          {isGroup ? 'Group Info' : 'Contact Info'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView>
        <View style={[styles.infoCard, { backgroundColor: cardColor }]}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarTextLarge}>
              {(conversation.name || 'Group').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.groupName, { color: textColor }]}>
            {conversation.name || (conversation.type === 'direct' ? 'Direct Chat' : 'Group')}
          </Text>
          <Text style={[styles.participantCount, { color: subTextColor }]}>
            Group • {conversation.participants.length} participants
          </Text>
        </View>

        <View style={[styles.participantsSection, { backgroundColor: cardColor }]}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            {conversation.participants.length} Participants
          </Text>

          {isGroup && isAdmin && (
            <TouchableOpacity style={styles.addParticipantBtn} onPress={() => setIsAdding(true)}>
              <View style={styles.addIconBg}>
                <UserPlus size={20} color="white" />
              </View>
              <Text style={styles.addParticipantText}>Add participants</Text>
            </TouchableOpacity>
          )}

          {conversation.participants.map(p => (
            <TouchableOpacity 
              key={p.id} 
              style={[styles.participantRow, { borderBottomColor: borderColor }]}
              onPress={() => handleParticipantAction(p.id, p.role || 'member')}
              disabled={!isGroup || !isAdmin || p.id === userId}
            >
              <View style={styles.avatarSmall}>
                <Text style={styles.avatarTextSmall}>{p.display_name?.charAt(0).toUpperCase() || 'U'}</Text>
              </View>
              <View style={styles.participantInfo}>
                <Text style={[styles.participantName, { color: textColor }]}>
                  {p.id === userId ? 'You' : p.display_name}
                </Text>
                <Text style={[styles.participantId, { color: subTextColor }]}>
                  ID: {p.id}
                </Text>
              </View>
              {p.role === 'admin' && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>Group Admin</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {isGroup && (
          <TouchableOpacity style={[styles.leaveGroupBtn, { backgroundColor: cardColor }]} onPress={handleLeaveGroup}>
            <Text style={styles.leaveGroupText}>Leave Group</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Add Participant Modal */}
      <Modal visible={isAdding} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Add Participant</Text>
              <TouchableOpacity onPress={() => setIsAdding(false)}>
                <X size={24} color={subTextColor} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSubtitle, { color: subTextColor }]}>Enter the 8-character Account ID</Text>
            <TextInput
              style={[styles.modalInput, { color: textColor, backgroundColor: isDark ? '#2A2A2D' : '#F3F4F6' }]}
              placeholder="XXXXXXXX"
              placeholderTextColor={subTextColor}
              value={searchId}
              onChangeText={text => setSearchId(text.toUpperCase())}
              maxLength={8}
            />
            <TouchableOpacity 
              style={[styles.modalBtn, (isSearching || searchId.length === 0) && { opacity: 0.5 }]} 
              onPress={handleAddParticipant}
              disabled={isSearching || searchId.length === 0}
            >
              <Text style={styles.modalBtnText}>{isSearching ? 'Adding...' : 'Add'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Action Sheet Modal */}
      <Modal visible={actionSheetVisible} animationType="fade" transparent>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActionSheetVisible(false)}>
          <View style={[styles.actionSheetContent, { backgroundColor: cardColor }]} onStartShouldSetResponder={() => true}>
            {actionSheetConfig.title ? (
              <Text style={[styles.actionSheetTitle, { color: subTextColor }]}>{actionSheetConfig.title}</Text>
            ) : null}
            {actionSheetConfig.options.map((opt, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.actionSheetBtn, i < actionSheetConfig.options.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: borderColor }]}
                onPress={() => {
                  opt.onPress();
                  setActionSheetVisible(false);
                }}
              >
                <Text style={[styles.actionSheetBtnText, opt.style === 'destructive' ? { color: '#EF4444' } : { color: brandColor }]}>
                  {opt.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  infoCard: {
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 8,
  },
  avatarLarge: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#9CA3AF',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  avatarTextLarge: { fontSize: 48, color: 'white', fontWeight: '600' },
  groupName: { fontSize: 24, fontWeight: '600', marginBottom: 4 },
  participantCount: { fontSize: 14 },
  participantsSection: { padding: 16, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16, color: '#10B981' },
  addParticipantBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  addIconBg: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#10B981',
    alignItems: 'center', justifyContent: 'center', marginRight: 16,
  },
  addParticipantText: { fontSize: 16, color: '#10B981', fontWeight: '500' },
  participantRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1,
  },
  avatarSmall: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#3B82F6',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarTextSmall: { color: 'white', fontSize: 16, fontWeight: '600' },
  participantInfo: { flex: 1 },
  participantName: { fontSize: 16, fontWeight: '500' },
  participantId: { fontSize: 13, marginTop: 2 },
  adminBadge: {
    borderWidth: 1, borderColor: '#10B981',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
  },
  adminBadgeText: { color: '#10B981', fontSize: 10, fontWeight: '600' },
  leaveGroupBtn: {
    paddingVertical: 16, paddingHorizontal: 16,
    alignItems: 'flex-start',
  },
  leaveGroupText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    width: '80%', padding: 24, borderRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalSubtitle: { fontSize: 14, marginBottom: 16 },
  modalInput: {
    height: 48, borderRadius: 8, paddingHorizontal: 16,
    fontSize: 16, marginBottom: 24, letterSpacing: 2, textAlign: 'center',
  },
  modalBtn: {
    backgroundColor: '#10B981', height: 48,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  modalBtnText: { color: 'white',    fontSize: 16,
    fontWeight: '600',
  },
  actionSheetContent: {
    width: '100%',
    paddingBottom: 24,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginTop: 'auto', // pushes to bottom
  },
  actionSheetTitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 12,
  },
  actionSheetBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionSheetBtnText: {
    fontSize: 18,
    fontWeight: '500',
  }
});
