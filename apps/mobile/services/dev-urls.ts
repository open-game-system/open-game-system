import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_URLS_KEY = '@ogs/recent_dev_urls';
const MAX_URLS = 10;

export async function getRecentDevUrls(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(RECENT_URLS_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as string[];
}

export async function addRecentDevUrl(url: string): Promise<void> {
  const urls = await getRecentDevUrls();
  const filtered = urls.filter((u) => u !== url);
  const updated = [url, ...filtered].slice(0, MAX_URLS);
  await AsyncStorage.setItem(RECENT_URLS_KEY, JSON.stringify(updated));
}
