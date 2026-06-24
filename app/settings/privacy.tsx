import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Clock, Eye, MessageSquare, Timer, Lock, Image as ImageIcon, Info } from 'lucide-react-native';
import { useAuthStore } from '@/store/authStore';

export default function PrivacySettingsScreen() {
  const router = useRouter();
  const { theme } = useAuthStore();
  const isDark = theme === 'dark';

  const [lastSeen, setLastSeen] = useState('My contacts');
  const [profilePhoto, setProfilePhoto] = useState('Everyone');
  const [about, setAbout] = useState('Everyone');
  const [timer, setTimer] = useState('Off');

  const bgColor = isDark ? '#111B21' : '#F0F2F5';
  const headerBg = isDark ? '#202C33' : '#008069';
  const cardBg = isDark ? '#111B21' : '#FFFFFF';
  const textColor = isDark ? '#E9EDEF' : '#111B21';
  const subTextColor = isDark ? '#8696A0' : '#54656F';
  const iconColor = isDark ? '#8696A0' : '#54656F';
  const borderColor = isDark ? '#222E35' : '#E9EDEF';

  const renderOption = (icon: any, title: string, value: string, onPress: () => void) => (
    <TouchableOpacity style={styles.optionRow} onPress={onPress}>
      {icon}
      <View style={styles.optionContent}>
        <Text style={[styles.optionLabel, { color: textColor }]}>{title}</Text>
        <Text style={[styles.optionValue, { color: subTextColor }]}>{value}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { backgroundColor: headerBg }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy</Text>
      </View>

      <ScrollView>
        <Text style={[styles.sectionTitle, { color: subTextColor }]}>Who can see my personal info</Text>
        
        <View style={[styles.section, { backgroundColor: cardBg, borderBottomColor: borderColor, borderTopColor: borderColor }]}>
          {renderOption(
            <Eye size={24} color={iconColor} />,
            'Last seen and online',
            lastSeen,
            () => setLastSeen(lastSeen === 'Everyone' ? 'Nobody' : 'Everyone')
          )}
          {renderOption(
            <ImageIcon size={24} color={iconColor} />,
            'Profile photo',
            profilePhoto,
            () => setProfilePhoto(profilePhoto === 'Everyone' ? 'My contacts' : 'Everyone')
          )}
          {renderOption(
            <Info size={24} color={iconColor} />,
            'About',
            about,
            () => setAbout(about === 'Everyone' ? 'Nobody' : 'Everyone')
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: subTextColor }]}>Disappearing messages</Text>
        
        <View style={[styles.section, { backgroundColor: cardBg, borderBottomColor: borderColor, borderTopColor: borderColor }]}>
          {renderOption(
            <Timer size={24} color={iconColor} />,
            'Default message timer',
            timer,
            () => setTimer(timer === 'Off' ? '24 hours' : 'Off')
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: subTextColor }]}>More</Text>
        
        <View style={[styles.section, { backgroundColor: cardBg, borderBottomColor: borderColor, borderTopColor: borderColor }]}>
          {renderOption(
            <Lock size={24} color={iconColor} />,
            'App lock',
            'Disabled',
            () => {}
          )}
          <TouchableOpacity style={styles.optionRow}>
            <View style={{ width: 24 }} />
            <View style={styles.optionContent}>
              <Text style={[styles.optionLabel, { color: textColor }]}>Blocked contacts</Text>
              <Text style={[styles.optionValue, { color: subTextColor }]}>0</Text>
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
  optionValue: {
    fontSize: 14,
    marginTop: 4,
  },
});
