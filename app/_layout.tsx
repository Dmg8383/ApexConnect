import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Platform } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useAuthStore } from '@/store/authStore';
import { useCallStore } from '@/store/callStore';
import { CallOverlay } from '@/components/CallOverlay';
import { useScreenSecurity } from '@/hooks/useScreenSecurity';
import { initSounds } from '@/lib/sounds';

export default function RootLayout() {
  useFrameworkReady();

  // Activate comprehensive screenshot + screen-recording prevention
  // Works on both native (expo-screen-capture) and web (CSS + JS multi-layer)
  useScreenSecurity();

  // Local flag — only tracks whether the initial session restore is done.
  // IMPORTANT: we do NOT watch the store's isLoading here because signIn()
  // and createAccount() also toggle isLoading, which would unmount the Stack
  // mid-flow and break navigation.
  const [isReady, setIsReady] = useState(false);
  const { theme } = useAuthStore();

  useEffect(() => {
    initSounds();
    useAuthStore.getState().loadUser().finally(() => {
      setIsReady(true);
      // Initialize WebRTC listeners if user is authenticated and socket is ready
      // We wrap it in setTimeout to ensure socket connection is established
      setTimeout(() => {
        useCallStore.getState().initCallListeners();
      }, 2000);
    });
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme === 'dark' ? '#111827' : '#F9FAFB' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <>
      {Platform.OS === 'web' && (
        <style dangerouslySetInnerHTML={{__html: `
          ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          ::-webkit-scrollbar-track {
            background: transparent;
          }
          ::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.2);
          }
          * {
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
          }
        `}} />
      )}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="new-chat" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <CallOverlay />
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}
