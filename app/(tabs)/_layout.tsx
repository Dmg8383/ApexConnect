import { Tabs, usePathname, useRouter } from 'expo-router';
import { MessageCircle, Users, Settings, Shield, User, ChevronLeft, ChevronRight, Phone } from 'lucide-react-native';
import { useAuthStore } from '@/store/authStore';
import { useState } from 'react';

import { Platform, View, TouchableOpacity, Image, Text } from 'react-native';

function WebSidebarStandalone() {
  const { user, theme } = useAuthStore();
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#202C33' : '#F0F2F5';
  const borderColor = isDark ? '#222E35' : '#E9EDEF';

  const [isCollapsed, setIsCollapsed] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const width = isCollapsed ? 64 : 200;

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
      paddingTop: 20, paddingBottom: 20, zIndex: 100,
      flexDirection: 'column', justifyContent: 'space-between',
      overflow: 'hidden',
    }}>
      <View style={{ width: '100%', gap: 16 }}>
        {/* Logo */}
        <View style={{ paddingHorizontal: 12, alignItems: 'center', marginBottom: 8 }}>
          {Platform.OS === 'web' ? (
            <img 
              src={((require('../../WhatsApp Image 2026-06-25 at 1.01.58 AM.jpeg') as any).uri) || require('../../WhatsApp Image 2026-06-25 at 1.01.58 AM.jpeg')} 
              style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'contain' }} 
              alt="Logo"
            />
          ) : (
            <Image 
              source={require('../../WhatsApp Image 2026-06-25 at 1.01.58 AM.jpeg')} 
              style={{ width: 40, height: 40, borderRadius: 8 }} 
            />
          )}
        </View>

        {/* Avatar */}
        <TouchableOpacity style={{ marginBottom: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' }}>
          {user?.avatar_url ? (
            Platform.OS === 'web' ? (
              <img src={user.avatar_url} style={{ width: 40, height: 40, borderRadius: 20, objectFit: 'cover' }} alt="Avatar" />
            ) : (
              <Image source={{ uri: user.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} />
            )
          ) : (
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: isDark ? '#374151' : '#E5E7EB', alignItems: 'center', justifyContent: 'center' }}>
              <User size={24} color={isDark ? '#E9EDEF' : '#4B5563'} />
            </View>
          )}
          {!isCollapsed && <Text style={{ marginLeft: 16, fontWeight: '600', color: isDark ? '#E9EDEF' : '#111B21' }}>Profile</Text>}
        </TouchableOpacity>

        {/* Top Icons */}
        {routes.map((route) => {
          if (route.adminOnly && !user?.is_admin) return null;
          
          const isFocused = pathname === route.path || (route.path === '/' && pathname === '/(tabs)');
          const color = isFocused ? (isDark ? '#00A884' : '#25D366') : (isDark ? '#8696A0' : '#54656F');
          const Icon = route.icon;

          return (
            <TouchableOpacity
              key={route.name}
              onPress={() => router.navigate(route.path as any)}
              style={{ marginHorizontal: 8, height: 48, flexDirection: 'row', alignItems: 'center', borderRadius: 24, backgroundColor: isFocused ? (isDark ? '#2A3942' : '#E9EDEF') : 'transparent', paddingHorizontal: 12 }}
            >
              <Icon size={24} color={color} />
              {!isCollapsed && <Text style={{ marginLeft: 16, color, fontWeight: '500' }}>{route.label}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Bottom Icons */}
      <View style={{ width: '100%', gap: 8 }}>
        <TouchableOpacity
          onPress={() => setIsCollapsed(!isCollapsed)}
          style={{ marginHorizontal: 8, height: 48, flexDirection: 'row', alignItems: 'center', borderRadius: 24, paddingHorizontal: 12 }}
        >
          {isCollapsed ? <ChevronRight size={24} color={isDark ? '#8696A0' : '#54656F'} /> : <ChevronLeft size={24} color={isDark ? '#8696A0' : '#54656F'} />}
          {!isCollapsed && <Text style={{ marginLeft: 16, color: isDark ? '#8696A0' : '#54656F', fontWeight: '500' }}>Collapse</Text>}
        </TouchableOpacity>

        {(() => {
          const isSettingsFocused = pathname === '/settings';
          const color = isSettingsFocused ? (isDark ? '#00A884' : '#25D366') : (isDark ? '#8696A0' : '#54656F');
          return (
            <TouchableOpacity
              onPress={() => router.navigate('/settings')}
              style={{ marginHorizontal: 8, height: 48, flexDirection: 'row', alignItems: 'center', borderRadius: 24, backgroundColor: isSettingsFocused ? (isDark ? '#2A3942' : '#E9EDEF') : 'transparent', paddingHorizontal: 12 }}
            >
              <Settings size={24} color={color} />
              {!isCollapsed && <Text style={{ marginLeft: 16, color, fontWeight: '500' }}>Settings</Text>}
            </TouchableOpacity>
          );
        })()}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { user, theme } = useAuthStore();
  const isDark = theme === 'dark';

  const tabsComponent = (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isDark ? '#00A884' : '#25D366',
        tabBarInactiveTintColor: isDark ? '#8696A0' : '#54656F',
        tabBarStyle: Platform.OS === 'web' ? { display: 'none' } : {
          backgroundColor: isDark ? '#111B21' : '#FFFFFF',
          borderTopColor: isDark ? '#202C33' : '#E9EDEF',
          paddingTop: 8,
          height: 80,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
        },
      }}
      tabBar={Platform.OS === 'web' ? () => null : undefined}
    >
      <Tabs.Screen name="index" options={{ title: 'Chats', href: user?.is_admin ? null : '/(tabs)' }} />
      <Tabs.Screen name="calls" options={{ title: 'Calls', href: user?.is_admin ? null : '/calls' }} />
      <Tabs.Screen name="contacts" options={{ title: 'Contacts', href: user?.is_admin ? null : '/contacts' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="admin" options={{ title: 'Admin', href: user?.is_admin ? '/(tabs)/admin' : null }} />
    </Tabs>
  );

  if (Platform.OS === 'web') {
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
