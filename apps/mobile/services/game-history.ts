import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "ogs:game-history";
const MAX_ENTRIES = 20;

export interface GameHistoryEntry {
  url: string;
  name: string;
  lastPlayed: string;
}

/**
 * Get recently played games from AsyncStorage.
 */
export async function getRecentGames(): Promise<GameHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GameHistoryEntry[];
  } catch {
    return [];
  }
}

/**
 * Add or update a game in the recent history.
 * Moves the game to the front of the list and updates lastPlayed.
 */
export async function addRecentGame(
  url: string,
  name: string
): Promise<void> {
  const games = await getRecentGames();
  const filtered = games.filter((g) => g.url !== url);
  const entry: GameHistoryEntry = {
    url,
    name,
    lastPlayed: new Date().toISOString(),
  };
  const updated = [entry, ...filtered].slice(0, MAX_ENTRIES);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Clear all game history.
 */
export async function clearRecentGames(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
