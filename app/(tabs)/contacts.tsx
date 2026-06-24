import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Keyboard,
  useWindowDimensions,
  Platform,
  Modal,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { UserPlus, Search, X, Check, Users, QrCode } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { FlashList } from '@shopify/flash-list';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useMessagesStore } from '@/store/messagesStore';
import { User } from '@/types/database';

export default function ContactsScreen() {
  const router = useRouter();
  const { userId, theme } = useAuthStore();
  const { conversations, createDirectConversation } = useMessagesStore();
  
  const isDark = theme === 'dark';

  // WhatsApp Theme colors
  const bgColor = isDark ? '#111B21' : '#FFFFFF';
  const headerBgColor = isDark ? '#202C33' : '#FFFFFF';
  const cardBgColor = isDark ? '#111B21' : '#FFFFFF';
  const inputBgColor = isDark ? '#202C33' : '#F0F2F5';
  const textColor = isDark ? '#E9EDEF' : '#111B21';
  const subTextColor = isDark ? '#8696A0' : '#54656F';
  const borderColor = isDark ? '#222E35' : '#E9EDEF';
  const myIdCardBg = isDark ? '#202C33' : '#F0F2F5';
  const copyBtnBg = isDark ? '#111B21' : '#FFFFFF';
  const brandColor = isDark ? '#00A884' : '#25D366';

  const [searchId, setSearchId] = useState('');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const { width } = useWindowDimensions();
  const isWideScreen = Platform.OS === 'web' && width > 768;

  // Extract unique contacts from existing conversations
  const contacts = React.useMemo(() => {
    const uniqueUsers = new Map<string, User>();
    conversations.forEach((conv) => {
      if (conv.type === 'direct') {
        const otherUser = conv.participants.find((p) => p.id !== userId);
        if (otherUser && !uniqueUsers.has(otherUser.id)) {
          uniqueUsers.set(otherUser.id, otherUser);
        }
      }
    });
    return Array.from(uniqueUsers.values()).sort((a, b) =>
      (a.display_name || '').localeCompare(b.display_name || '')
    );
  }, [conversations, userId]);

  const [isScanning, setIsScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const handleOpenScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission needed', 'Camera permission is required to scan QR codes.');
        return;
      }
    }
    setIsScanning(true);
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    setIsScanning(false);
    setSearchId(data);
    handleSearch(data);
  };

  const handleSearch = async (overrideQuery?: string | React.MouseEvent<HTMLButtonElement, MouseEvent> | React.TouchEvent<HTMLButtonElement>) => {
    const query = typeof overrideQuery === 'string' ? overrideQuery : searchId;
    
    if (!query.trim()) {
      Alert.alert('Error', 'Please enter an account ID');
      return;
    }

    Keyboard.dismiss();
    setIsSearching(true);
    setFoundUser(null);

    try {
      const data = await api.get<User>(`/api/users/${query.trim()}`);

      if (data.id === userId) {
        Alert.alert('Error', 'You cannot add yourself as a contact');
        setIsSearching(false);
        return;
      }

      setFoundUser(data);
    } catch (error) {
      Alert.alert('No Contact Found', 'No user found with this Username or ID.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartChat = async (targetUserId: string) => {
    setIsCreating(true);
    try {
      const conversation = await createDirectConversation(targetUserId);
      router.push(`/chat/${conversation.id}`);
      // Clear search after starting chat
      setSearchId('');
      setFoundUser(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to create conversation');
    } finally {
      setIsCreating(false);
    }
  };

  const copyUserId = async () => {
    if (!userId) return;
    const Clipboard = await import('expo-clipboard');
    await Clipboard.setStringAsync(userId);
    Alert.alert('Copied', 'Your account ID copied to clipboard');
  };

  const renderContact = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={[styles.contactCard, { borderBottomColor: borderColor }]}
      onPress={() => handleStartChat(item.id)}
    >
      <View style={[styles.contactAvatar, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]}>
        <Text style={[styles.contactAvatarText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>
          {item.display_name?.charAt(0).toUpperCase() || 'U'}
        </Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, { color: textColor }]}>{item.display_name}</Text>
        <Text style={[styles.contactId, { color: subTextColor }]}>ID: {item.id}</Text>
      </View>
    </TouchableOpacity>
  );

  if (!userId) {
    return <Redirect href="/auth" />;
  }

  const contactsContent = (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { backgroundColor: headerBgColor }]}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Select contact</Text>
        <Text style={[styles.headerSubtitle, { color: subTextColor }]}>
          {contacts.length} contacts
        </Text>
      </View>

      <View style={[styles.myIdContainer, { backgroundColor: myIdCardBg, borderBottomColor: borderColor }]}>
        <View style={styles.myIdBox}>
          <Text style={[styles.myIdLabel, { color: subTextColor }]}>Your Account ID</Text>
          <Text style={styles.myIdValue}>{userId}</Text>
        </View>
        <TouchableOpacity style={[styles.copyButton, { backgroundColor: copyBtnBg }]} onPress={copyUserId}>
          <Check size={20} color={textColor} />
          <Text style={[styles.copyButtonText, { color: textColor }]}>Copy</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchSection}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>Find User</Text>
        <View style={[styles.searchContainer, { backgroundColor: inputBgColor }]}>
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Enter Username or ID"
            placeholderTextColor={subTextColor}
            value={searchId}
            onChangeText={setSearchId}
            autoCapitalize="none"
          />
          {searchId.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchId('');
                setFoundUser(null);
              }}
              style={styles.clearButton}
            >
              <X size={20} color={subTextColor} />
            </TouchableOpacity>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            style={[styles.searchButton, { backgroundColor: brandColor, flex: 1 }, isSearching && styles.buttonLoading]}
            onPress={handleSearch}
            disabled={isSearching}
          >
            <Search size={20} color="white" />
            <Text style={styles.searchButtonText}>
              {isSearching ? 'Searching...' : 'Search'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.searchButton, { backgroundColor: inputBgColor, paddingHorizontal: 16 }]}
            onPress={handleOpenScanner}
          >
            <QrCode size={20} color={textColor} />
          </TouchableOpacity>
        </View>
      </View>

      {foundUser && (
        <View style={[styles.resultContainer, { backgroundColor: cardBgColor }]}>
          <View style={styles.userCard}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {foundUser.display_name?.charAt(0).toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: textColor }]}>{foundUser.display_name}</Text>
              <Text style={[styles.userId, { color: subTextColor }]}>ID: {foundUser.id}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.startChatButton, { backgroundColor: brandColor }, isCreating && styles.buttonLoading]}
            onPress={() => handleStartChat(foundUser.id)}
            disabled={isCreating}
          >
            <UserPlus size={20} color="white" />
            <Text style={styles.startChatButtonText}>
              {isCreating ? 'Creating...' : 'Start Chat'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.contactsListSection}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>My Contacts</Text>
        {contacts.length === 0 ? (
          <View style={styles.emptyContacts}>
            <Users size={48} color={subTextColor} />
            <Text style={[styles.emptyContactsText, { color: subTextColor }]}>
              No contacts yet. Search for a user above to start chatting!
            </Text>
          </View>
        ) : (
          <FlashList
            data={contacts}
            renderItem={renderContact}
            keyExtractor={(item) => item.id}
            estimatedItemSize={72}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      {/* QR Scanner Modal */}
      <Modal visible={isScanning} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'black' }}>
          <View style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }}>
            <TouchableOpacity onPress={() => setIsScanning(false)} style={{ padding: 12, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 24 }}>
              <X size={24} color="white" />
            </TouchableOpacity>
          </View>
          {isScanning && (
            <CameraView
              style={{ flex: 1 }}
              barcodeScannerSettings={{
                barcodeTypes: ["qr"],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            />
          )}
          <View style={{ position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' }}>
            <Text style={{ color: 'white', fontSize: 16, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 }}>
              Point your camera at a QR code
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );

  if (isWideScreen) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: bgColor }}>
        <View style={{ width: 400, borderRightWidth: 1, borderRightColor: borderColor }}>
          {contactsContent}
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
          <Text style={{ color: textColor, fontSize: 24, fontWeight: '300' }}>ApexConnect Contacts</Text>
          <Text style={{ color: subTextColor, marginTop: 8 }}>Select or search for a contact to start chatting</Text>
        </View>
      </View>
    );
  }

  return contactsContent;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  myIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  myIdBox: {
    flex: 1,
  },
  myIdLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  myIdValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3B82F6',
    letterSpacing: 2,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  searchSection: {
    padding: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
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
    height: 52,
    paddingHorizontal: 16,
    fontSize: 18,
    color: '#111827',
    letterSpacing: 2,
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
    padding: 16,
    backgroundColor: '#F9FAFB',
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 20,
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
  contactsListSection: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  listContent: {
    paddingBottom: 20,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  contactAvatarText: {
    fontSize: 18,
    fontWeight: '600',
  },
  contactInfo: {
    flex: 1,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.2)',
    paddingBottom: 12,
  },
  contactName: {
    fontSize: 17,
    fontWeight: '600',
  },
  contactId: {
    fontSize: 14,
    marginTop: 2,
  },
  emptyContacts: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyContactsText: {
    marginTop: 12,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
