import AsyncStorage from "@react-native-async-storage/async-storage";
import { isOnboardingComplete, markOnboardingComplete, resetOnboarding } from "../onboarding";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("onboarding", () => {
  describe("isOnboardingComplete", () => {
    it("returns false when no value stored", async () => {
      mockedAsyncStorage.getItem.mockResolvedValue(null);
      expect(await isOnboardingComplete()).toBe(false);
      expect(mockedAsyncStorage.getItem).toHaveBeenCalledWith("@ogs/onboarding_complete");
    });

    it('returns false when value is not "true"', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue("false");
      expect(await isOnboardingComplete()).toBe(false);
    });

    it('returns true when value is "true"', async () => {
      mockedAsyncStorage.getItem.mockResolvedValue("true");
      expect(await isOnboardingComplete()).toBe(true);
    });
  });

  describe("markOnboardingComplete", () => {
    it('stores "true" in AsyncStorage', async () => {
      await markOnboardingComplete();
      expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith("@ogs/onboarding_complete", "true");
    });
  });

  describe("resetOnboarding", () => {
    it("removes the key from AsyncStorage", async () => {
      await resetOnboarding();
      expect(mockedAsyncStorage.removeItem).toHaveBeenCalledWith("@ogs/onboarding_complete");
    });
  });
});
