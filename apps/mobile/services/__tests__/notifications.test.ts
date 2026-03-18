import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Notifications from "expo-notifications";
// Device is mocked via mockDevice variable above the jest.mock call
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import {
  addPushTokenListener,
  getGameUrlFromNotification,
  getOrCreateDeviceId,
  initializePushNotifications,
  registerDeviceWithAPI,
  registerForPushNotifications,
} from "../notifications";

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  addPushTokenListener: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));

let mockIsDevice = true;
jest.mock("expo-device", () => ({
  get isDevice() {
    return mockIsDevice;
  },
}));

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        eas: {
          projectId: "test-project-id",
        },
      },
    },
    easConfig: {
      projectId: "test-project-id",
    },
  },
}));

// Mock fetch globally
const mockFetch = jest.fn();
(globalThis as any).fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
  mockIsDevice = true;
});

describe("notifications", () => {
  describe("getOrCreateDeviceId", () => {
    it("returns existing device ID from SecureStore", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("existing-uuid");

      const result = await getOrCreateDeviceId();

      expect(result).toBe("existing-uuid");
      expect(SecureStore.getItemAsync).toHaveBeenCalledWith("ogs_device_id");
      expect(Crypto.randomUUID).not.toHaveBeenCalled();
    });

    it("creates and persists new device ID when none exists", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      (Crypto.randomUUID as jest.Mock).mockReturnValue("new-uuid-123");

      const result = await getOrCreateDeviceId();

      expect(result).toBe("new-uuid-123");
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith("ogs_device_id", "new-uuid-123");
    });
  });

  describe("registerForPushNotifications", () => {
    it("returns null on simulator/emulator and logs appropriate message", async () => {
      mockIsDevice = false;
      const logSpy = jest.spyOn(console, "log").mockImplementation();

      const result = await registerForPushNotifications();

      expect(result).toBeNull();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[Notifications]"));
      logSpy.mockRestore();
    });

    it("returns push token when permissions already granted", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[abc123]",
      });

      const result = await registerForPushNotifications();

      expect(result).toBe("ExponentPushToken[abc123]");
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it("requests permissions when not already granted", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "undetermined",
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[xyz789]",
      });

      const result = await registerForPushNotifications();

      expect(result).toBe("ExponentPushToken[xyz789]");
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    it("returns null and logs when permissions denied", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "undetermined",
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "denied",
      });

      const logSpy = jest.spyOn(console, "log").mockImplementation();
      const result = await registerForPushNotifications();

      expect(result).toBeNull();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("[Notifications] Permission denied"),
      );
      logSpy.mockRestore();
    });

    it("returns null and logs error when no EAS project ID in expoConfig", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });

      const originalExpoConfig = Constants.expoConfig;
      const originalEasConfig = (Constants as any).easConfig;
      (Constants as any).expoConfig = { extra: { eas: {} } };
      (Constants as any).easConfig = {};

      const errorSpy = jest.spyOn(console, "error").mockImplementation();
      const result = await registerForPushNotifications();

      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith("[Notifications] No EAS project ID found");
      errorSpy.mockRestore();

      (Constants as any).expoConfig = originalExpoConfig;
      (Constants as any).easConfig = originalEasConfig;
    });

    it("falls back to easConfig.projectId when expoConfig has no projectId", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[fallback]",
      });

      // expoConfig has no projectId, but easConfig does
      const originalExpoConfig = Constants.expoConfig;
      (Constants as any).expoConfig = { extra: { eas: {} } };

      const result = await registerForPushNotifications();

      expect(result).toBe("ExponentPushToken[fallback]");
      expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
        projectId: "test-project-id",
      });

      (Constants as any).expoConfig = originalExpoConfig;
    });

    it("returns null when expoConfig.extra is null", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });

      const originalExpoConfig = Constants.expoConfig;
      const originalEasConfig = (Constants as any).easConfig;
      (Constants as any).expoConfig = { extra: null };
      (Constants as any).easConfig = {};

      const result = await registerForPushNotifications();

      expect(result).toBeNull();

      (Constants as any).expoConfig = originalExpoConfig;
      (Constants as any).easConfig = originalEasConfig;
    });

    it("returns null when expoConfig.extra.eas is null", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });

      const originalExpoConfig = Constants.expoConfig;
      const originalEasConfig = (Constants as any).easConfig;
      (Constants as any).expoConfig = { extra: { eas: null } };
      (Constants as any).easConfig = {};

      const result = await registerForPushNotifications();

      expect(result).toBeNull();

      (Constants as any).expoConfig = originalExpoConfig;
      (Constants as any).easConfig = originalEasConfig;
    });

    it("returns null when expoConfig is entirely null", async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });

      const originalExpoConfig = Constants.expoConfig;
      const originalEasConfig = (Constants as any).easConfig;
      (Constants as any).expoConfig = null;
      (Constants as any).easConfig = null;

      const result = await registerForPushNotifications();

      expect(result).toBeNull();

      (Constants as any).expoConfig = originalExpoConfig;
      (Constants as any).easConfig = originalEasConfig;
    });

    it("sets up Android notification channel on Android", async () => {
      const originalOS = Platform.OS;
      Object.defineProperty(Platform, "OS", { value: "android", configurable: true });

      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[android123]",
      });

      await registerForPushNotifications();

      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        "default",
        expect.objectContaining({
          name: "Default",
          importance: 5, // AndroidImportance.MAX
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
        }),
      );

      Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true });
    });

    it("does NOT set up notification channel on iOS", async () => {
      const originalOS = Platform.OS;
      Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });

      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[ios123]",
      });

      await registerForPushNotifications();

      expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();

      Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true });
    });
  });

  describe("registerDeviceWithAPI", () => {
    it("posts device info to API and returns true on success", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ deviceId: "device_xyz", registered: true }),
      });

      const logSpy = jest.spyOn(console, "log").mockImplementation();
      const result = await registerDeviceWithAPI("device_xyz", "push-token-123");

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith("https://api.opengame.org/api/v1/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ogsDeviceId: "device_xyz",
          platform: Platform.OS,
          pushToken: "push-token-123",
        }),
      });
      expect(logSpy).toHaveBeenCalledWith("[Notifications] Device registered:", expect.any(Object));
      logSpy.mockRestore();
    });

    it("returns false and logs error when API returns error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Bad request" }),
      });

      const errorSpy = jest.spyOn(console, "error").mockImplementation();
      const result = await registerDeviceWithAPI("device_xyz", "bad-token");

      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(
        "[Notifications] Device registration failed:",
        expect.any(Object),
      );
      errorSpy.mockRestore();
    });

    it("returns false and logs error when fetch throws network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const errorSpy = jest.spyOn(console, "error").mockImplementation();
      const result = await registerDeviceWithAPI("device_xyz", "token");

      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(
        "[Notifications] Device registration error:",
        expect.any(Error),
      );
      errorSpy.mockRestore();
    });
  });

  describe("initializePushNotifications", () => {
    it("orchestrates full flow: device ID + permissions + registration", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue("device-123");
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "granted",
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: "ExponentPushToken[token123]",
      });
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ registered: true }),
      });

      const result = await initializePushNotifications();

      expect(result).toBe("device-123");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("returns device ID even when push token is null (permissions denied)", async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
      (Crypto.randomUUID as jest.Mock).mockReturnValue("new-device-id");
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "undetermined",
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: "denied",
      });

      const result = await initializePushNotifications();

      expect(result).toBe("new-device-id");
      expect(mockFetch).not.toHaveBeenCalled(); // No API call without push token
    });
  });

  describe("addPushTokenListener", () => {
    it("registers listener and re-registers device on token change", () => {
      const mockRemove = { remove: jest.fn() };
      let capturedCallback: (token: { data: string }) => void;

      (Notifications.addPushTokenListener as jest.Mock).mockImplementation((cb) => {
        capturedCallback = cb;
        return mockRemove;
      });

      const subscription = addPushTokenListener("device-123");

      expect(Notifications.addPushTokenListener).toHaveBeenCalled();
      expect(subscription).toBe(mockRemove);

      // Simulate token rotation
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ registered: true }),
      });

      capturedCallback!({ data: "new-push-token" });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.opengame.org/api/v1/devices/register",
        expect.objectContaining({
          body: expect.stringContaining("new-push-token"),
        }),
      );
    });
  });

  describe("getGameUrlFromNotification", () => {
    it("extracts URL from notification data", () => {
      const notification = {
        request: {
          content: {
            data: { url: "https://triviajam.tv/games/abc123" },
          },
        },
      } as unknown as Notifications.Notification;

      expect(getGameUrlFromNotification(notification)).toBe("https://triviajam.tv/games/abc123");
    });

    it("returns null when no URL in notification data", () => {
      const notification = {
        request: {
          content: {
            data: { type: "general" },
          },
        },
      } as unknown as Notifications.Notification;

      expect(getGameUrlFromNotification(notification)).toBeNull();
    });

    it("returns null when data is empty", () => {
      const notification = {
        request: {
          content: {
            data: {},
          },
        },
      } as unknown as Notifications.Notification;

      expect(getGameUrlFromNotification(notification)).toBeNull();
    });
  });
});
