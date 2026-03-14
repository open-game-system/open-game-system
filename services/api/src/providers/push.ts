export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  /** Whether the device's push token is still valid */
  deviceActive: boolean;
}

export interface PushProvider {
  send(
    pushToken: string,
    notification: PushNotification
  ): Promise<PushResult>;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** Expo error codes that indicate the device token is no longer valid */
const DEVICE_INACTIVE_ERRORS = ["DeviceNotRegistered", "InvalidCredentials"];

/**
 * Expo Push provider — sends notifications via Expo's push service,
 * which handles APNs (iOS) and FCM (Android) delivery.
 */
export class ExpoPushProvider implements PushProvider {
  private accessToken?: string;

  constructor(accessToken?: string) {
    this.accessToken = accessToken;
  }

  async send(
    pushToken: string,
    notification: PushNotification
  ): Promise<PushResult> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const body = {
      to: pushToken,
      title: notification.title,
      body: notification.body,
      ...(notification.data && { data: notification.data }),
    };

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const result = await response.json() as {
        data: Array<{
          status: "ok" | "error";
          id?: string;
          message?: string;
          details?: { error?: string };
        }>;
      };

      const ticket = result.data[0];

      if (ticket.status === "error") {
        const errorCode = ticket.details?.error ?? ticket.message ?? "Unknown Expo push error";
        const deviceActive = !DEVICE_INACTIVE_ERRORS.includes(errorCode);

        return {
          success: false,
          error: errorCode,
          deviceActive,
        };
      }

      return {
        success: true,
        providerMessageId: ticket.id,
        deviceActive: true,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to send push notification",
        deviceActive: true, // Network error doesn't mean device is invalid
      };
    }
  }
}

/**
 * Returns the push provider for the given platform.
 * Both iOS and Android use Expo Push since the app uses expo-notifications.
 */
export function getProviderForPlatform(
  _platform: "ios" | "android",
  accessToken?: string
): PushProvider {
  return new ExpoPushProvider(accessToken);
}
