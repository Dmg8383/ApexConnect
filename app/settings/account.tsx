import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Key, Smartphone, FileText, Trash2 } from 'lucide-react-native';
import { useAuthStore } from '@/store/authStore';

export default function AccountSettingsScreen() {
  const router = useRouter();
  const { theme } = useAuthStore();
  const isDark = theme === 'dark';

  const [securityNotifs, setSecurityNotifs] = useState(true);

  const bgColor = isDark ? '#111B21' : '#F0F2F5';
  const headerBg = isDark ? '#202C33' : '#008069';
  const cardBg = isDark ? '#111B21' : '#FFFFFF';
  const textColor = isDark ? '#E9EDEF' : '#111B21';
  const subTextColor = isDark ? '#8696A0' : '#54656F';
  const iconColor = isDark ? '#8696A0' : '#54656F';

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerBg }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account</Text>
      </View>

      <ScrollView>
        <View style={[styles.section, { backgroundColor: cardBg }]}>
          
          <View style={styles.optionRow}>
            <Key size={24} color={iconColor} />
            <View style={styles.optionContent}>
              <Text style={[styles.optionLabel, { color: textColor }]}>Security notifications</Text>
              <Text style={[styles.optionHint, { color: subTextColor }]}>
                Show security notifications on this device
              </Text>
            </View>
            <Switch
              value={securityNotifs}
              onValueChange={setSecurityNotifs}
              trackColor={{ false: '#767577', true: '#00A884' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <TouchableOpacity style={styles.optionRow}>
            <Smartphone size={24} color={iconColor} />
            <View style={styles.optionContent}>
              <Text style={[styles.optionLabel, { color: textColor }]}>Change number</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionRow}>
            <FileText size={24} color={iconColor} />
            <View style={styles.optionContent}>
              <Text style={[styles.optionLabel, { color: textColor }]}>Request account info</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionRow}>
            <Trash2 size={24} color="#EF4444" />
            <View style={styles.optionContent}>
              <Text style={[styles.optionLabel, { color: '#EF4444' }]}>Delete my account</Text>
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
  section: {
    marginTop: 10,
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
    marginTop: 4,
  },
});
