import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import { Shield, User, Trash2, Edit3, X, Check, Search, Users, MessageSquare, Activity, HelpCircle, QrCode } from 'lucide-react-native';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { Redirect } from 'expo-router';

// Extended types for admin panel
interface AdminUser {
  id: string;
  username: string;
  display_name: string;
  is_admin: boolean;
  is_active: boolean;
  created_at: string;
  last_seen_at: string;
  conversation_count: number;
}

interface AuditLog {
  id: string;
  user_id: string;
  username: string;
  action: string;
  ip_address: string;
  details: any;
  created_at: string;
}

interface AdminConversation {
  id: string;
  type: string;
  participant_count: number;
  created_at: string;
}

interface SupportMessage {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  message: string;
  status: string;
  created_at: string;
}

type TabType = 'users' | 'chats' | 'logs' | 'support';

export default function AdminScreen() {
  const { user, theme } = useAuthStore();
  const isDark = theme === 'dark';

  // Theme colors
  const bgColor = isDark ? '#111827' : '#F3F4F6';
  const headerBgColor = isDark ? '#1F2937' : 'white';
  const cardBgColor = isDark ? '#1F2937' : 'white';
  const inputBgColor = isDark ? '#374151' : 'white';
  const textColor = isDark ? '#F9FAFB' : '#111827';
  const subTextColor = isDark ? '#9CA3AF' : '#6B7280';
  const borderColor = isDark ? '#374151' : '#E5E7EB';
  const tabBtnBg = isDark ? '#374151' : '#F3F4F6';
  const modalBg = isDark ? '#1F2937' : 'white';
  const actionBtnBg = isDark ? '#4B5563' : '#F3F4F6';
  


  const [activeTab, setActiveTab] = useState<TabType>('users');
  
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit Modal State
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editIsActive, setEditIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // QR Modal State
  const [qrUser, setQrUser] = useState<AdminUser | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      if (activeTab === 'users') {
        const data = await api.get<AdminUser[]>('/api/admin/users');
        setUsers(data);
      } else if (activeTab === 'logs') {
        const data = await api.get<AuditLog[]>('/api/admin/audit_logs');
        setLogs(data);
      } else if (activeTab === 'chats') {
        const data = await api.get<AdminConversation[]>('/api/admin/conversations');
        setConversations(data);
      } else if (activeTab === 'support') {
        const data = await api.get<SupportMessage[]>('/api/admin/support');
        setSupportMessages(data);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || `Failed to fetch ${activeTab}`);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResolveSupport = async (id: string) => {
    try {
      await api.patch(`/api/admin/support/${id}`, { status: 'resolved' });
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to resolve ticket');
    }
  };

  const handleDeleteUser = (userId: string, username: string) => {
    if (userId === user.id) {
      Alert.alert('Restricted', 'You cannot delete yourself.');
      return;
    }

    const confirmMessage = `Are you sure you want to delete ${username}? This action cannot be undone.`;
    
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        performDelete(userId);
      }
    } else {
      Alert.alert('Delete User', confirmMessage, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => performDelete(userId) }
      ]);
    }
  };

  const performDelete = async (userId: string) => {
    try {
      await api.delete(`/api/admin/users/${userId}`);
      Alert.alert('Deleted', 'User deleted successfully.');
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to delete user');
    }
  };

  const openEditModal = (u: AdminUser) => {
    setEditingUser(u);
    setEditDisplayName(u.display_name || '');
    setEditUsername(u.username || '');
    setEditIsAdmin(u.is_admin);
    setEditIsActive(u.is_active !== false); // default to true if undefined
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    try {
      setIsSaving(true);
      await api.patch(`/api/admin/users/${editingUser.id}`, {
        display_name: editDisplayName,
        username: editUsername,
        is_admin: editIsAdmin,
        is_active: editIsActive,
      });
      setEditingUser(null);
      Alert.alert('Success', 'User updated successfully.');
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update user');
    } finally {
      setIsSaving(false);
    }
  };

  // Render helpers
  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (u.display_name && u.display_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    u.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!user?.is_admin) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { backgroundColor: headerBgColor }]}>
        <Text style={[styles.headerTitle, { color: textColor }]}>God Level Admin</Text>
        <Shield size={24} color="#3B82F6" />
      </View>

      <View style={[styles.tabBar, { backgroundColor: headerBgColor, borderBottomColor: borderColor }]}>
        <TouchableOpacity 
          style={[styles.tabBtn, { backgroundColor: tabBtnBg }, activeTab === 'users' && styles.tabBtnActive]}
          onPress={() => setActiveTab('users')}
        >
          <Users size={20} color={activeTab === 'users' ? '#3B82F6' : '#6B7280'} />
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>Users</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabBtn, { backgroundColor: tabBtnBg }, activeTab === 'chats' && styles.tabBtnActive]}
          onPress={() => setActiveTab('chats')}
        >
          <MessageSquare size={20} color={activeTab === 'chats' ? '#3B82F6' : subTextColor} />
          <Text style={[styles.tabText, { color: subTextColor }, activeTab === 'chats' && styles.tabTextActive]}>Chats</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabBtn, { backgroundColor: tabBtnBg }, activeTab === 'logs' && styles.tabBtnActive]}
          onPress={() => setActiveTab('logs')}
        >
          <Activity size={20} color={activeTab === 'logs' ? '#3B82F6' : subTextColor} />
          <Text style={[styles.tabText, { color: subTextColor }, activeTab === 'logs' && styles.tabTextActive]}>Audit Logs</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabBtn, { backgroundColor: tabBtnBg }, activeTab === 'support' && styles.tabBtnActive]}
          onPress={() => setActiveTab('support')}
        >
          <HelpCircle size={20} color={activeTab === 'support' ? '#3B82F6' : subTextColor} />
          <Text style={[styles.tabText, { color: subTextColor }, activeTab === 'support' && styles.tabTextActive]}>Support</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'users' && (
        <View style={[styles.searchContainer, { backgroundColor: inputBgColor }]}>
          <Search size={20} color={subTextColor} />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Search users..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={subTextColor}
            autoCapitalize="none"
          />
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
          {activeTab === 'users' && filteredUsers.map((u) => (
            <View key={u.id} style={[styles.card, { backgroundColor: cardBgColor }]}>
              <View style={styles.userInfo}>
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: textColor }]}>
                    {u.display_name} {u.is_admin && '🛡️'} {u.is_active === false && '❌ (Inactive)'}
                  </Text>
                  <Text style={[styles.userHandle, { color: subTextColor }]}>@{u.username} • ID: {u.id}</Text>
                </View>
                <Text style={styles.monoText}>ID: {u.id}</Text>
                <Text style={[styles.metaText, { color: subTextColor }]}>Contacts: {u.conversation_count}</Text>
              </View>

              <View style={styles.userActions}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: actionBtnBg }]} onPress={() => setQrUser(u)}>
                  <QrCode size={20} color="#10B981" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: actionBtnBg }]} onPress={() => openEditModal(u)}>
                  <Edit3 size={20} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionBtn, { backgroundColor: actionBtnBg }]} 
                  onPress={() => handleDeleteUser(u.id, u.username)}
                  disabled={u.id === user.id}
                >
                  <Trash2 size={20} color={u.id === user.id ? subTextColor : "#EF4444"} />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {activeTab === 'chats' && conversations.map((c) => (
            <View key={c.id} style={[styles.card, { backgroundColor: cardBgColor }]}>
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: textColor }]}>Conversation</Text>
                <Text style={[styles.metaText, { color: subTextColor }]}>Type: {c.type.toUpperCase()}</Text>
                <Text style={styles.monoText}>ID: {c.id}</Text>
              </View>
              <View style={styles.chatStats}>
                <Text style={[styles.statNumber, { color: textColor }]}>{c.participant_count}</Text>
                <Text style={[styles.statLabel, { color: subTextColor }]}>Participants</Text>
              </View>
            </View>
          ))}

          {activeTab === 'logs' && logs.map((l) => (
            <View key={l.id} style={[styles.card, { backgroundColor: cardBgColor }]}>
              <View style={styles.userInfo}>
                <View style={styles.userHeader}>
                  <Text style={styles.actionBadge(l.action)}>{l.action.toUpperCase()}</Text>
                  <Text style={styles.usernameText}>@{l.username || l.user_id}</Text>
                </View>
                <Text style={styles.monoText}>IP: {l.ip_address || 'Unknown'}</Text>
                <Text style={[styles.metaText, { color: subTextColor }]}>{new Date(l.created_at).toLocaleString()}</Text>
              </View>
            </View>
          ))}

          {activeTab === 'support' && supportMessages.map((s) => (
            <View key={s.id} style={[styles.card, { backgroundColor: cardBgColor, flexDirection: 'column', alignItems: 'flex-start' }]}>
              <View style={[styles.userHeader, { justifyContent: 'space-between', width: '100%' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.userName, { color: textColor }]}>{s.display_name}</Text>
                  <Text style={styles.usernameText}>@{s.username}</Text>
                </View>
                <Text style={[styles.actionBadge(s.status), { backgroundColor: s.status === 'open' ? '#FEE2E2' : '#D1FAE5', color: s.status === 'open' ? '#EF4444' : '#10B981' }]}>
                  {s.status.toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.metaText, { marginVertical: 8, color: textColor, fontSize: 16 }]}>{s.message}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center', marginTop: 8 }}>
                <Text style={styles.monoText}>{new Date(s.created_at).toLocaleString()}</Text>
                {s.status === 'open' && (
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: actionBtnBg }]} onPress={() => handleResolveSupport(s.id)}>
                    <Check size={16} color="#10B981" />
                    <Text style={{ color: '#10B981', fontWeight: '600', marginLeft: 4 }}>Resolve</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          {((activeTab === 'users' && filteredUsers.length === 0) || 
            (activeTab === 'chats' && conversations.length === 0) ||
            (activeTab === 'logs' && logs.length === 0) ||
            (activeTab === 'support' && supportMessages.length === 0)) && (
            <Text style={styles.emptyText}>No data found.</Text>
          )}
        </ScrollView>
      )}

      {/* Edit User Modal */}
      <Modal visible={!!editingUser} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Edit User</Text>
              <TouchableOpacity onPress={() => setEditingUser(null)}>
                <X size={24} color={subTextColor} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: textColor }]}>Display Name</Text>
              <TextInput
                style={[styles.input, { color: textColor, borderColor: borderColor }]}
                value={editDisplayName}
                onChangeText={setEditDisplayName}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: textColor }]}>Username</Text>
              <TextInput
                style={[styles.input, { color: textColor, borderColor: borderColor }]}
                value={editUsername}
                onChangeText={setEditUsername}
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setEditIsAdmin(!editIsAdmin)}
            >
              <View style={[styles.checkbox, editIsAdmin && styles.checkboxChecked, !editIsAdmin && { borderColor: borderColor }]}>
                {editIsAdmin && <Check size={16} color="white" />}
              </View>
              <Text style={[styles.checkboxLabel, { color: textColor }]}>Give Admin Rights</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.checkboxContainer, { marginTop: 12 }]}
              onPress={() => setEditIsActive(!editIsActive)}
            >
              <View style={[styles.checkbox, editIsActive && styles.checkboxChecked, !editIsActive && { borderColor: borderColor }]}>
                {editIsActive && <Check size={16} color="white" />}
              </View>
              <Text style={[styles.checkboxLabel, { color: textColor }]}>User is Active (Can Login)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={handleSaveEdit}
              disabled={isSaving}
            >
              <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* QR Code Modal */}
      <Modal visible={!!qrUser} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: modalBg, alignItems: 'center', minHeight: 'auto' }]}>
            <View style={[styles.modalHeader, { width: '100%' }]}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Share Contact</Text>
              <TouchableOpacity onPress={() => setQrUser(null)}>
                <X size={24} color={subTextColor} />
              </TouchableOpacity>
            </View>
            <Text style={{ color: subTextColor, marginBottom: 24, textAlign: 'center' }}>
              Scan this QR code to add <Text style={{ fontWeight: 'bold', color: textColor }}>{qrUser?.display_name}</Text>
            </Text>
            
            <View style={{ padding: 16, backgroundColor: 'white', borderRadius: 16, marginBottom: 24 }}>
              {qrUser && (
                <Image 
                  source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${qrUser.id}` }}
                  style={{ width: 250, height: 250 }}
                />
              )}
            </View>
            
            <Text style={[styles.monoText, { fontSize: 16, color: subTextColor }]}>{qrUser?.id}</Text>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#EFF6FF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#3B82F6',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 16,
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  usernameText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  monoText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#4B5563',
  },
  userActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    padding: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  chatStats: {
    alignItems: 'flex-end',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  actionBadge: (action: string) => ({
    backgroundColor: action.includes('delete') ? '#FEE2E2' : action.includes('update') ? '#FEF3C7' : '#D1FAE5',
    color: action.includes('delete') ? '#EF4444' : action.includes('update') ? '#D97706' : '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: '700' as any,
    overflow: 'hidden',
  }),
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#6B7280',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: '60%',
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
    color: '#111827',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
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
