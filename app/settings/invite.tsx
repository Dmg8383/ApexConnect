import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView, Share } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Share2, Link as LinkIcon } from 'lucide-react-native';
import { useAuthStore } from '@/store/authStore';

export default function InviteSettingsScreen() {
  const router = useRouter();
  const { theme } = useAuthStore();
  const isDark = theme === 'dark';

  const bgColor = isDark ? '#111B21' : '#F0F2F5';
  const headerBg = isDark ? '#202C33' : '#008069';
  const cardBg = isDark ? '#111B21' : '#FFFFFF';
  const textColor = isDark ? '#E9EDEF' : '#111B21';
  const subTextColor = isDark ? '#8696A0' : '#54656F';
  const iconColor = isDark ? '#8696A0' : '#54656F';
  const brandColor = isDark ? '#00A884' : '#25D366';

  const inviteLink = 'https://apexconnect.app/invite';

  const handleShare = async () => {
    try {
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({
            title: 'Join me on ApexConnect',
            text: 'Let\'s chat on ApexConnect! It\'s a fast, simple, and secure app we can use to message and call each other for free.',
            url: inviteLink,
          });
        } else {
          // Fallback for web
          navigator.clipboard.writeText(inviteLink);
          alert('Link copied to clipboard!');
        }
      } else {
        await Share.share({
          message: `Let's chat on ApexConnect! It's a fast, simple, and secure app we can use to message and call each other for free. Get it at ${inviteLink}`,
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <View style={[styles.header, { backgroundColor: headerBg }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invite a friend</Text>
      </View>

      <ScrollView>
        <View style={styles.heroSection}>
          <View style={[styles.heroIconContainer, { backgroundColor: brandColor }]}>
            <Share2 size={48} color="white" />
          </View>
          <Text style={[styles.heroTitle, { color: textColor }]}>
            Invite your friends
          </Text>
          <Text style={[styles.heroSubtitle, { color: subTextColor }]}>
            Connect with friends and family seamlessly on ApexConnect.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: cardBg }]}>
          <TouchableOpacity style={styles.optionRow} onPress={handleShare}>
            <Share2 size={24} color={iconColor} />
            <View style={styles.optionContent}>
              <Text style={[styles.optionLabel, { color: textColor }]}>Share link</Text>
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
  heroSection: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  heroIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  section: {
    paddingVertical: 8,
    marginTop: 10,
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
});
