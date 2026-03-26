import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_COUNT_KEY = "@ogs/session_count";
const SWIPE_HINT_THRESHOLD = 5;

export async function getSessionCount(): Promise<number> {
  const value = await AsyncStorage.getItem(SESSION_COUNT_KEY);
  return value ? parseInt(value, 10) : 0;
}

export async function incrementSessionCount(): Promise<number> {
  const current = await getSessionCount();
  const next = current + 1;
  await AsyncStorage.setItem(SESSION_COUNT_KEY, String(next));
  return next;
}

export async function shouldShowSwipeHint(): Promise<boolean> {
  const count = await getSessionCount();
  return count < SWIPE_HINT_THRESHOLD;
}
