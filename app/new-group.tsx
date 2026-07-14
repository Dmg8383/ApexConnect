import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Keyboard,
  FlatList,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { UserPlus, Search, X, ArrowLeft, Users, Check } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useMessagesStore } from '@/store/messagesStore';
import { User } from '@/types/database';

export default function NewGroupScreen() {
  const router = useRouter();
  const { userId } = useAuthStore();
  const { createGroupConversation, conversations } = useMessagesStore();

  const [groupName, setGroupName] = useState('');
  const [searchId, setSearchId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

  const handleBack = () => {
    router.back();
  };

  const handleSearch = async () => {
    if (!searchId.trim()) {
      Alert.alert('Error', 'Please enter an account ID');
      return;
    }

    Keyboard.dismiss();
    setIsSearching(true);

    try {
      const data = await api.get<User>(`/api/users/${searchId.trim().toUpperCase()}`);

      if (data.id === userId) {
        Alert.alert('Error', 'You cannot add yourself (you are added automatically)');
        return;
      }

      if (selectedUsers.find(u => u.id === data.id)) {
        Alert.alert('Info', 'User is already added to the list');
        setSearchId('');
        return;
      }

      setSelectedUsers([...selectedUsers, data]);
      setSearchId('');
    } catch (error) {
      Alert.alert('Not Found', 'No account found with this ID');
    } finally {
      setIsSearching(false);
    }
  };

  const suggestedContacts = useMemo(() => {
    const contactsMap = new Map<string, User>();
    conversations.forEach(conv => {
      if (conv.type === 'direct') {
        const other = conv.participants.find(p => p.id !== userId);
        if (other) {
          contactsMap.set(other.id, other);
        }
      }
    });
    return Array.from(contactsMap.values());
  }, [conversations, userId]);

  const removeUser = (id: string) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== id));
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    if (selectedUsers.length === 0) {
      Alert.alert('Error', 'Please add at least one participant');
      return;
    }

    setIsCreating(true);
    try {
      const participantIds = selectedUsers.map(u => u.id);
      const conversation = await createGroupConversation(groupName.trim(), participantIds);
      router.replace(`/chat/${conversation.id}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Group</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.groupNameContainer}>
          <View style={styles.groupIcon}>
            <Users size={28} color="white" />
          </View>
          <TextInput
            style={styles.groupNameInput}
            placeholder="Group Subject"
            placeholderTextColor="#9CA3AF"
            value={groupName}
            onChangeText={setGroupName}
          />
        </View>

        <Text style={styles.subtitle}>Add Participants by ID</Text>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="XXXXXXXX"
            placeholderTextColor="#9CA3AF"
            value={searchId}
            onChangeText={(text) => setSearchId(text.toUpperCase())}
            maxLength={8}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            style={[styles.addButton, isSearching && styles.buttonDisabled]}
            onPress={handleSearch}
            disabled={isSearching}
          >
            <UserPlus size={20} color="white" />
          </TouchableOpacity>
        </View>

        {suggestedContacts.length > 0 && (
          <View style={{ marginBottom: 24 }}>
            <Text style={styles.subtitle}>Recent Contacts</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.contactsScroll}>
              {suggestedContacts.map(contact => {
                const isSelected = selectedUsers.some(u => u.id === contact.id);
                return (
                  <TouchableOpacity
                    key={contact.id}
                    style={[styles.contactPill, isSelected && styles.contactPillSelected]}
                    onPress={() => {
                      if (isSelected) {
                        removeUser(contact.id);
                      } else {
                        setSelectedUsers([...selectedUsers, contact]);
                      }
                    }}
                  >
                    <View style={styles.contactAvatarSmall}>
                      {isSelected ? (
                        <Check size={16} color="white" />
                      ) : (
                        <Text style={styles.contactAvatarTextSmall}>{contact.display_name?.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <Text style={[styles.contactName, isSelected && styles.contactNameSelected]}>{contact.display_name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <Text style={styles.participantsHeader}>
          Participants ({selectedUsers.length})
        </Text>

        <FlatList
          data={selectedUsers}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.userCard}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {item.display_name?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.display_name}</Text>
                <Text style={styles.userId}>ID: {item.id}</Text>
              </View>
              <TouchableOpacity onPress={() => removeUser(item.id)} style={styles.removeButton}>
                <X size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No participants added yet.</Text>
          }
          style={styles.list}
        />

        <TouchableOpacity
          style={[styles.createButton, (isCreating || selectedUsers.length === 0 || !groupName) && styles.buttonDisabled]}
          onPress={handleCreateGroup}
          disabled={isCreating || selectedUsers.length === 0 || !groupName}
        >
          <Text style={styles.createButtonText}>
            {isCreating ? 'Creating...' : 'Create Group'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  groupNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  groupIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#9CA3AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  groupNameInput: {
    flex: 1,
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#10B981',
    fontSize: 16,
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    letterSpacing: 1,
    color: '#111827',
  },
  addButton: {
    width: 48,
    height: 48,
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantsHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  list: {
    flex: 1,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  userId: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    marginTop: 24,
  },
  createButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  contactsScroll: {
    flexDirection: 'row',
  },
  contactPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contactPillSelected: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  contactAvatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  contactAvatarTextSmall: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  contactName: {
    fontSize: 14,
    color: '#374151',
  },
  contactNameSelected: {
    color: '#065F46',
    fontWeight: '500',
  },
});
