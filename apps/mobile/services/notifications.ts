import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";

const OGS_DEVICE_ID_KEY = "ogs_device_id";
const API_BASE_URL = "https://api.opengame.org";

// Configure how notifications are displayed when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Gets or creates a stable device ID persisted in SecureStore.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(OGS_DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }
  const deviceId = Crypto.randomUUID();
  await SecureStore.setItemAsync(OGS_DEVICE_ID_KEY, deviceId);
  return deviceId;
}

/**
 * Requests notification permissions and returns the push token.
 * Returns null if permissions are denied or the device doesn't support push.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log(
      "[Notifications] Push notifications are not supported on simulator/emulator"
    );
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not already granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[Notifications] Permission denied");
    return null;
  }

  // Get the Expo push token
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) {
    console.error("[Notifications] No EAS project ID found");
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  console.log("[Notifications] Push token:", tokenData.data);

  // Set up Android notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  return tokenData.data;
}

/**
 * Registers the device with the OGS API.
 */
export async function registerDeviceWithAPI(
  ogsDeviceId: string,
  pushToken: string
): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/devices/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ogsDeviceId,
        platform: Platform.OS as "ios" | "android",
        pushToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("[Notifications] Device registration failed:", error);
      return false;
    }

    const data = await response.json();
    console.log("[Notifications] Device registered:", data);
    return true;
  } catch (error) {
    console.error("[Notifications] Device registration error:", error);
    return false;
  }
}

/**
 * Full initialization: get device ID, request permissions, register with API.
 * Returns the ogsDeviceId.
 */
export async function initializePushNotifications(): Promise<string> {
  const ogsDeviceId = await getOrCreateDeviceId();
  console.log("[Notifications] Device ID:", ogsDeviceId);

  const pushToken = await registerForPushNotifications();
  if (pushToken) {
    await registerDeviceWithAPI(ogsDeviceId, pushToken);
  }

  return ogsDeviceId;
}

/**
 * Listener for push token changes. Call this to keep the API in sync
 * when the OS rotates the push token.
 */
export function addPushTokenListener(
  ogsDeviceId: string
) {
  return Notifications.addPushTokenListener(async (token) => {
    console.log("[Notifications] Push token changed:", token.data);
    await registerDeviceWithAPI(ogsDeviceId, token.data);
  });
}

/**
 * Extract the game URL from a notification's data payload.
 */
export function getGameUrlFromNotification(
  notification: Notifications.Notification
): string | null {
  const data = notification.request.content.data;
  return (data?.url as string) ?? null;
}
