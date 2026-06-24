import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, Smartphone, MonitorSmartphone } from 'lucide-react-native';
import { useAuthStore } from '@/store/authStore';

export default function NotificationsSettingsScreen() {
  const router = useRouter();
  const { theme } = useAuthStore();
  const isDark = theme === 'dark';

  const [conversationTones, setConversationTones] = useState(true);
  const [highPriority, setHighPriority] = useState(true);
  const [reactionNotifs, setReactionNotifs] = useState(true);

  const bgColor = isDark ? '#111B21' : '#F0F2F5';
  const headerBg = isDark ? '#202C33' : '#008069';
  const cardBg = isDark ? '#111B21' : '#FFFFFF';
  const textColor = isDark ? '#E9EDEF' : '#111B21';
  const subTextColor = isDark ? '#8696A0' : '#54656F';
  const borderColor = isDark ? '#222E35' : '#E9EDEF';

  const renderToggle = (title: string, hint: string, value: boolean, onValueChange: (v: boolean) => void) => (
    <View style={styles.optionRow}>
      <View style={styles.optionContent}>
        <Text style={[styles.optionLabel, { color: textColor }]}>{title}</Text>
        {hint && <Text style={[styles.optionHint, { color: subTextColor }]}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#767577', true: '#00A884' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );

  const renderSelect = (title: string, value: string) => (
    <TouchableOpacity style={styles.optionRow}>
      <View style={styles.optionContent}>
        <Text style={[styles.optionLabel, { color: textColor }]}>{title}</Text>
        <Text style={[styles.optionHint, { color: subTextColor }]}>{value}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { backgroundColor: headerBg }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <ScrollView>
        <View style={[styles.section, { backgroundColor: cardBg, borderBottomColor: borderColor, marginTop: 10 }]}>
          {renderToggle(
            'Conversation tones',
            'Play sounds for incoming and outgoing messages.',
            conversationTones,
            setConversationTones
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: subTextColor }]}>Messages</Text>
        <View style={[styles.section, { backgroundColor: cardBg, borderBottomColor: borderColor, borderTopColor: borderColor }]}>
          {renderSelect('Notification tone', 'Default (Aurora)')}
          {renderSelect('Vibrate', 'Default')}
          {renderSelect('Popup notification', 'No popup')}
          {renderSelect('Light', 'White')}
          {renderToggle(
            'Use high priority notifications',
            'Show previews of notifications at the top of the screen',
            highPriority,
            setHighPriority
          )}
          {renderToggle(
            'Reaction Notifications',
            'Show notifications for reactions to messages you send',
            reactionNotifs,
            setReactionNotifs
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: subTextColor }]}>Groups</Text>
        <View style={[styles.section, { backgroundColor: cardBg, borderBottomColor: borderColor, borderTopColor: borderColor }]} >
          {renderSelect('Notification tone', 'Default (Aurora)')}
          {renderSelect('Vibrate', 'Default')}
          {renderSelect('Light', 'White')}
        </View>

        <Text style={[styles.sectionTitle, { color: subTextColor }]}>Calls</Text>
        <View style={[styles.section, { backgroundColor: cardBg, borderBottomColor: borderColor, borderTopColor: borderColor, marginBottom: 40 }]} >
          {renderSelect('Ringtone', 'Default')}
          {renderSelect('Vibrate', 'Default')}
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
