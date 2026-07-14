import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useMessagesStore } from '@/store/messagesStore';

const isExpoGo = Constants.appOwnership === 'expo';
let Notifications: any = null;

if (!isExpoGo && Platform.OS !== 'web') {
  Notifications = require('expo-notifications');
  
  // Set how notifications should be handled when the app is in the foreground
  Notifications.setNotificationHandler({
    handleNotification: async (notification: any) => {
      const data = notification.request.content.data;
      const activeConversationId = useMessagesStore.getState().activeConversationId;
      
      // If the notification is for the chat room we are currently looking at, silently ignore it!
      if (data && data.conversation_id && data.conversation_id === activeConversationId) {
        return {
          shouldShowBanner: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        };
      }
      
      return {
        shouldShowBanner: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    },
  });
}


export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00A884',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }
    
    if (!Notifications) {
      console.warn('Push Notifications are not fully supported in Expo Go. Skipping registration.');
      return null;
    }
    
    try {
      // Get the Expo push token
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;
        
      if (!projectId) {
        console.warn('No EAS Project ID found, skipping push registration in Expo Go.');
        return null;
      }
        
      token = (await Notifications.getExpoPushTokenAsync({
        projectId,
      })).data;
      console.log('Expo Push Token:', token);
    } catch (e) {
      console.warn('Push Notifications are not fully supported in Expo Go. Skipping registration.');
      // Suppress the error so it doesn't red-screen the app
    }
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}
