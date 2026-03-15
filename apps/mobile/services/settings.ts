import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVELOPER_MODE_KEY = '@ogs/developer_mode';
const DEBUG_OVERLAY_KEY = '@ogs/debug_overlay';
const SOUNDS_ENABLED_KEY = '@ogs/sounds_enabled';

export async function isDeveloperMode(): Promise<boolean> {
  const value = await AsyncStorage.getItem(DEVELOPER_MODE_KEY);
  return value === 'true';
}

export async function setDeveloperMode(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(DEVELOPER_MODE_KEY, String(enabled));
  if (!enabled) {
    await AsyncStorage.setItem(DEBUG_OVERLAY_KEY, 'false');
  }
}

export async function isDebugOverlay(): Promise<boolean> {
  const value = await AsyncStorage.getItem(DEBUG_OVERLAY_KEY);
  return value === 'true';
}

export async function setDebugOverlay(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(DEBUG_OVERLAY_KEY, String(enabled));
}

export async function isSoundsEnabled(): Promise<boolean> {
  const value = await AsyncStorage.getItem(SOUNDS_ENABLED_KEY);
  return value !== 'false'; // Default to true
}

export async function setSoundsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(SOUNDS_ENABLED_KEY, String(enabled));
}
