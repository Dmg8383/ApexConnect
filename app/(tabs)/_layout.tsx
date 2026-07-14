import { Tabs, usePathname, useRouter } from 'expo-router';
import { MessageCircle, Users, Settings, Shield, User, ChevronLeft, ChevronRight, Phone } from 'lucide-react-native';
import { getMediaUrl } from '@/lib/media';
import { useAuthStore } from '@/store/authStore';
import { useState } from 'react';

import { Platform, View, TouchableOpacity, Image, Text, useColorScheme, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function WebSidebarStandalone() {
  const { user, theme } = useAuthStore();
  const systemTheme = useColorScheme() ?? 'light';
  const isDark = (theme === 'system' ? systemTheme : theme) === 'dark';
  
  // Premium Dark Mode Colors
  const bgColor = isDark ? '#09090B' : '#F0F2F5';
  const borderColor = isDark ? 'rgba(255,255,255,0.05)' : '#E9EDEF';

  const pathname = usePathname();
  const router = useRouter();

  const width = 68; // Slightly larger than 64px for better touch targets

  const routes = [
    { name: 'index', path: '/', icon: MessageCircle, label: 'Chats' },
    { name: 'calls', path: '/calls', icon: Phone, label: 'Calls' },
    { name: 'contacts', path: '/contacts', icon: Users, label: 'Contacts' },
    { name: 'admin', path: '/admin', icon: Shield, label: 'Admin', adminOnly: true },
  ];

  return (
    <View style={{
      width, height: '100%',
      backgroundColor: bgColor, borderRightWidth: 1, borderRightColor: borderColor,
      paddingTop: 24, paddingBottom: 24, zIndex: 100,
      flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center',
      overflow: 'hidden',
    }}>
      <View style={{ width: '100%', alignItems: 'center', gap: 24 }}>
        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 12, overflow: 'hidden', width: 44, height: 44, borderRadius: 12 }}>
          {Platform.OS === 'web' ? (
            <img 
              src={((require('../../Gemini_Generated_Image_g4ldb2g4ldb2g4ld-removebg-preview.png') as any).uri) || require('../../Gemini_Generated_Image_g4ldb2g4ldb2g4ld-removebg-preview.png')} 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
              alt="Logo"
            />
          ) : (
            <Image 
              source={require('../../Gemini_Generated_Image_g4ldb2g4ldb2g4ld-removebg-preview.png')} 
              style={{ width: '100%', height: '100%', resizeMode: 'contain' }} 
            />
          )}
        </View>

        {/* Top Icons */}
        {routes.map((route) => {
          if (route.adminOnly && !user?.is_admin) return null;
          
          const isFocused = pathname === route.path || (route.path === '/' && pathname === '/(tabs)');
          const color = isFocused ? (isDark ? '#10B981' : '#10B981') : (isDark ? '#A1A1AA' : '#54656F');
          const Icon = route.icon;

          return (
            <TouchableOpacity
              key={route.name}
              onPress={() => router.navigate(route.path as any)}
              style={{
                width: 44, height: 44,
                justifyContent: 'center', alignItems: 'center',
                borderRadius: 12,
                backgroundColor: isFocused ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#E9EDEF') : 'transparent',
              }}
            >
              <Icon size={22} color={color} strokeWidth={isFocused ? 2.5 : 2} />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Bottom Icons */}
      <View style={{ width: '100%', alignItems: 'center', gap: 24 }}>
        {(() => {
          const isSettingsFocused = pathname === '/settings';
          const color = isSettingsFocused ? (isDark ? '#10B981' : '#10B981') : (isDark ? '#A1A1AA' : '#54656F');
          return (
            <TouchableOpacity
              onPress={() => router.navigate('/settings')}
              style={{
                width: 44, height: 44,
                justifyContent: 'center', alignItems: 'center',
                borderRadius: 12,
                backgroundColor: isSettingsFocused ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#E9EDEF') : 'transparent',
              }}
            >
              <Settings size={22} color={color} strokeWidth={isSettingsFocused ? 2.5 : 2} />
            </TouchableOpacity>
          );
        })()}

        {/* Avatar at bottom */}
        <TouchableOpacity style={{ alignItems: 'center' }} onPress={() => router.navigate('/settings')}>
          {user?.avatar_url ? (
            Platform.OS === 'web' ? (
              <img src={getMediaUrl(user.avatar_url)!} style={{ width: 44, height: 44, borderRadius: 22, objectFit: 'cover' }} alt="Avatar" />
            ) : (
              <Image source={{ uri: getMediaUrl(user.avatar_url)! }} style={{ width: 44, height: 44, borderRadius: 22 }} />
            )
          ) : (
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: isDark ? '#27272A' : '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
              <User size={24} color={isDark ? '#FAFAFA' : '#4B5563'} />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}


export default function TabLayout() {
  const { user, theme } = useAuthStore();
  const systemTheme = useColorScheme() ?? 'light';
  const isDark = (theme === 'system' ? systemTheme : theme) === 'dark';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWideScreen = Platform.OS === 'web' && width > 768;

  const tabsComponent = (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDark ? '#00A884' : '#25D366',
        tabBarInactiveTintColor: isDark ? '#8696A0' : '#54656F',
        tabBarStyle: isWideScreen ? { display: 'none' } : {
          backgroundColor: isDark ? '#111B21' : '#FFFFFF',
          borderTopColor: isDark ? '#202C33' : '#E9EDEF',
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
          height: 60 + Math.max(insets.bottom, 8),
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
        },
      }}
      tabBar={isWideScreen ? () => null : undefined}
    >
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Chats', 
          href: user?.is_admin ? null : '/(tabs)',
          tabBarIcon: ({ color, size }) => <MessageCircle size={size} color={color} />
        }} 
      />
      <Tabs.Screen 
        name="calls" 
        options={{ 
          title: 'Calls', 
          href: user?.is_admin ? null : '/calls',
          tabBarIcon: ({ color, size }) => <Phone size={size} color={color} />
        }} 
      />
      <Tabs.Screen 
        name="contacts" 
        options={{ 
          title: 'Contacts', 
          href: user?.is_admin ? null : '/contacts',
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />
        }} 
      />
      <Tabs.Screen 
        name="settings" 
        options={{ 
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />
        }} 
      />
      <Tabs.Screen 
        name="admin" 
        options={{ 
          title: 'Admin', 
          href: user?.is_admin ? '/(tabs)/admin' : null,
          tabBarIcon: ({ color, size }) => <Shield size={size} color={color} />
        }} 
      />
    </Tabs>
  );

  if (isWideScreen) {
    return (
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <WebSidebarStandalone />
        <View style={{ flex: 1 }}>
          {tabsComponent}
        </View>
      </View>
    );
  }

  return tabsComponent;
}
