import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getRecentGames,
  addRecentGame,
  clearRecentGames,
  type GameHistoryEntry,
} from "../game-history";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("game-history", () => {
  describe("getRecentGames", () => {
    it("returns an empty array when no history exists", async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);
      const games = await getRecentGames();
      expect(games).toEqual([]);
      expect(mockedAsyncStorage.getItem).toHaveBeenCalledWith(
        "ogs:game-history"
      );
    });

    it("returns parsed games from storage", async () => {
      const stored: GameHistoryEntry[] = [
        {
          url: "https://triviajam.tv",
          name: "Trivia Jam",
          lastPlayed: "2026-03-14T00:00:00.000Z",
        },
      ];
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(stored));

      const games = await getRecentGames();
      expect(games).toEqual(stored);
    });

    it("returns an empty array when storage contains invalid JSON", async () => {
      mockedAsyncStorage.getItem.mockResolvedValue("not-json");
      const games = await getRecentGames();
      expect(games).toEqual([]);
    });
  });

  describe("addRecentGame", () => {
    it("adds a new game entry to empty history", async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);
      mockedAsyncStorage.setItem.mockResolvedValue(undefined);

      await addRecentGame("https://triviajam.tv", "Trivia Jam");

      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
        "ogs:game-history",
        expect.any(String)
      );
      const saved = JSON.parse(
        mockedAsyncStorage.setItem.mock.calls[0][1] as string
      ) as GameHistoryEntry[];
      expect(saved).toHaveLength(1);
      expect(saved[0].url).toBe("https://triviajam.tv");
      expect(saved[0].name).toBe("Trivia Jam");
      expect(saved[0].lastPlayed).toBeDefined();
    });

    it("updates lastPlayed when adding an existing game URL", async () => {
      const existing: GameHistoryEntry[] = [
        {
          url: "https://triviajam.tv",
          name: "Trivia Jam",
          lastPlayed: "2026-01-01T00:00:00.000Z",
        },
      ];
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(existing));
      mockedAsyncStorage.setItem.mockResolvedValue(undefined);

      await addRecentGame("https://triviajam.tv", "Trivia Jam");

      const saved = JSON.parse(
        mockedAsyncStorage.setItem.mock.calls[0][1] as string
      ) as GameHistoryEntry[];
      expect(saved).toHaveLength(1);
      expect(saved[0].url).toBe("https://triviajam.tv");
      // lastPlayed should be updated (not the old date)
      expect(saved[0].lastPlayed).not.toBe("2026-01-01T00:00:00.000Z");
    });

    it("moves existing game to front of list", async () => {
      const existing: GameHistoryEntry[] = [
        {
          url: "https://game1.com",
          name: "Game 1",
          lastPlayed: "2026-03-13T00:00:00.000Z",
        },
        {
          url: "https://game2.com",
          name: "Game 2",
          lastPlayed: "2026-03-12T00:00:00.000Z",
        },
      ];
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(existing));
      mockedAsyncStorage.setItem.mockResolvedValue(undefined);

      await addRecentGame("https://game2.com", "Game 2");

      const saved = JSON.parse(
        mockedAsyncStorage.setItem.mock.calls[0][1] as string
      ) as GameHistoryEntry[];
      expect(saved[0].url).toBe("https://game2.com");
      expect(saved[1].url).toBe("https://game1.com");
    });

    it("limits history to 20 entries", async () => {
      const existing: GameHistoryEntry[] = Array.from({ length: 20 }, (_, i) => ({
        url: `https://game${i}.com`,
        name: `Game ${i}`,
        lastPlayed: new Date(2026, 0, i + 1).toISOString(),
      }));
      mockedAsyncStorage.getItem.mockResolvedValue(JSON.stringify(existing));
      mockedAsyncStorage.setItem.mockResolvedValue(undefined);

      await addRecentGame("https://newgame.com", "New Game");

      const saved = JSON.parse(
        mockedAsyncStorage.setItem.mock.calls[0][1] as string
      ) as GameHistoryEntry[];
      expect(saved).toHaveLength(20);
      expect(saved[0].url).toBe("https://newgame.com");
    });
  });

  describe("clearRecentGames", () => {
    it("removes the history key from storage", async () => {
      mockedAsyncStorage.removeItem.mockResolvedValue(undefined);
      await clearRecentGames();
      expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith(
        "ogs:game-history"
      );
    });
  });
});
