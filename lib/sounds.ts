import { Audio } from 'expo-av';
import { Platform, LogBox } from 'react-native';

// Suppress the deprecation warning for expo-av to keep logs clean
LogBox.ignoreLogs(['Expo AV has been deprecated']);
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0]?.includes?.('Expo AV has been deprecated')) return;
  originalWarn(...args);
};

const SOUND_FILES = {
  send: require('../assets/sounds/send.wav'),
  receive: require('../assets/sounds/receive.wav'),
  error: require('../assets/sounds/error.wav'),
};

const sounds: Record<string, Audio.Sound> = {};

export async function initSounds() {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    });
  } catch (error) {
    console.warn('Failed to initialize audio mode:', error);
  }
}

export async function playSound(type: keyof typeof SOUND_FILES) {
  try {
    if (!sounds[type]) {
      const { sound } = await Audio.Sound.createAsync(SOUND_FILES[type]);
      sounds[type] = sound;
    }
    
    // Stop if already playing, then play from start
    await sounds[type].stopAsync();
    await sounds[type].playAsync();
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
