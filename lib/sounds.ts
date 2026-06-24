import { Audio } from 'expo-av';
import { Platform } from 'react-native';

// Standard Google Action royalty-free sounds to mimic messaging app tones
const SOUND_URLS = {
  send: 'https://actions.google.com/sounds/v1/water/water_drop.ogg',
  receive: 'https://actions.google.com/sounds/v1/notifications/positive_notification.ogg',
  error: 'https://actions.google.com/sounds/v1/alarms/error_beep.ogg',
};

// Cache for loaded sounds
const sounds: Record<string, Audio.Sound> = {};

export async function initSounds() {
  try {
    // Only initialize if we're on a platform that supports expo-av easily, though Web should work too
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });
  } catch (error) {
    console.warn('Failed to initialize audio mode:', error);
  }
}

export async function playSound(type: keyof typeof SOUND_URLS) {
  try {
    // Web browsers often block audio until user interaction
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const audio = new window.Audio(SOUND_URLS[type]);
      audio.volume = 0.5;
      await audio.play().catch(e => console.warn('Web audio blocked:', e));
      return;
    }

    if (!sounds[type]) {
      const { sound } = await Audio.Sound.createAsync({ uri: SOUND_URLS[type] });
      sounds[type] = sound;
    }
    
    await sounds[type].replayAsync();
  } catch (error) {
    console.warn(`Failed to play sound ${type}:`, error);
  }
}

export async function unloadSounds() {
  for (const key of Object.keys(sounds)) {
    if (sounds[key]) {
      await sounds[key].unloadAsync();
      delete sounds[key];
    }
  }
}
