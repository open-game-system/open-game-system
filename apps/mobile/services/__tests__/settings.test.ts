import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  isDebugOverlay,
  isDeveloperMode,
  isSoundsEnabled,
  setDebugOverlay,
  setDeveloperMode,
  setSoundsEnabled,
} from "../settings";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("settings", () => {
  describe("isDeveloperMode", () => {
    it("returns false when no value stored", async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);
      expect(await isDeveloperMode()).toBe(false);
    });

    it('returns true when stored as "true"', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue("true");
      expect(await isDeveloperMode()).toBe(true);
    });

    it('returns false when stored as "false"', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue("false");
      expect(await isDeveloperMode()).toBe(false);
    });
  });

  describe("setDeveloperMode", () => {
    it("stores enabled state", async () => {
      await setDeveloperMode(true);
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith("@ogs/developer_mode", "true");
    });

    it("disables debug overlay when developer mode is turned off", async () => {
      await setDeveloperMode(false);
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith("@ogs/developer_mode", "false");
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith("@ogs/debug_overlay", "false");
    });

    it("does not touch debug overlay when enabling developer mode", async () => {
      await setDeveloperMode(true);
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledTimes(1);
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith("@ogs/developer_mode", "true");
    });
  });

  describe("isDebugOverlay", () => {
    it("returns false when no value stored", async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);
      expect(await isDebugOverlay()).toBe(false);
    });

    it('returns true when stored as "true"', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue("true");
      expect(await isDebugOverlay()).toBe(true);
    });
  });

  describe("setDebugOverlay", () => {
    it("stores enabled state", async () => {
      await setDebugOverlay(true);
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith("@ogs/debug_overlay", "true");
    });
  });

  describe("isSoundsEnabled", () => {
    it("returns true when no value stored (default)", async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);
      expect(await isSoundsEnabled()).toBe(true);
    });

    it('returns true when stored as "true"', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue("true");
      expect(await isSoundsEnabled()).toBe(true);
    });

    it('returns false when stored as "false"', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue("false");
      expect(await isSoundsEnabled()).toBe(false);
    });
  });

  describe("setSoundsEnabled", () => {
    it("stores enabled state", async () => {
      await setSoundsEnabled(false);
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith("@ogs/sounds_enabled", "false");
    });
  });
});
