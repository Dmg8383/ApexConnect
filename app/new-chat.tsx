import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { UserPlus, Search, X, ArrowLeft } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useMessagesStore } from '@/store/messagesStore';
import { User } from '@/types/database';

export default function NewChatScreen() {
  const router = useRouter();
  const { userId } = useAuthStore();
  const { createDirectConversation } = useMessagesStore();

  const [searchId, setSearchId] = useState('');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleSearch = async () => {
    if (!searchId.trim()) {
      Alert.alert('Error', 'Please enter an account ID');
      return;
    }

    Keyboard.dismiss();
    setIsSearching(true);
    setFoundUser(null);

    try {
      const data = await api.get<User>(`/api/users/${searchId.trim().toUpperCase()}`);

      if (data.id === userId) {
        Alert.alert('Error', 'You cannot chat with yourself');
        setIsSearching(false);
        return;
      }

      setFoundUser(data);
    } catch (error) {
      Alert.alert('Not Found', 'No account found with this ID');
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartChat = async () => {
    if (!foundUser) return;

    setIsCreating(true);
    try {
      const conversation = await createDirectConversation(foundUser.id);
      router.replace(`/chat/${conversation.id}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to create conversation');
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
        <Text style={styles.headerTitle}>New Chat</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={styles.subtitle}>
          Enter the 8-character account ID of the person you want to chat with
        </Text>

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
          {searchId.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchId('');
                setFoundUser(null);
              }}
              style={styles.clearButton}
            >
              <X size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.searchButton, isSearching && styles.buttonLoading]}
          onPress={handleSearch}
          disabled={isSearching}
        >
          <Search size={20} color="white" />
          <Text style={styles.searchButtonText}>
            {isSearching ? 'Searching...' : 'Search'}
          </Text>
        </TouchableOpacity>

        {foundUser && (
          <View style={styles.resultContainer}>
            <View style={styles.userCard}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {foundUser.display_name?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{foundUser.display_name}</Text>
                <Text style={styles.userId}>ID: {foundUser.id}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.startChatButton, isCreating && styles.buttonLoading]}
              onPress={handleStartChat}
              disabled={isCreating}
            >
              <UserPlus size={20} color="white" />
              <Text style={styles.startChatButtonText}>
                {isCreating ? 'Creating...' : 'Start Chat'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.infoText}>
            Share your account ID ({userId}) with others so they can find you
          </Text>
        </View>

        <View style={{ marginTop: 40 }}>
          <TouchableOpacity
            style={styles.newGroupButton}
            onPress={() => router.push('/new-group')}
          >
            <View style={styles.newGroupIcon}>
              <UserPlus size={24} color="white" />
            </View>
            <Text style={styles.newGroupText}>New Group</Text>
          </TouchableOpacity>
        </View>
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
    padding: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    height: 56,
    paddingHorizontal: 16,
    fontSize: 20,
    color: '#111827',
    textAlign: 'center',
    letterSpacing: 2,
    fontWeight: '600',
  },
  clearButton: {
    padding: 12,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    height: 52,
    gap: 8,
  },
  searchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonLoading: {
    opacity: 0.6,
  },
  resultContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  userAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 22,
    fontWeight: '600',
    color: 'white',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  userId: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  startChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    borderRadius: 12,
    height: 48,
    gap: 8,
  },
  startChatButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  info: {
    marginTop: 32,
  },
  infoText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  newGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  newGroupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  newGroupText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
});
