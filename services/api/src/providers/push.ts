import { z } from "zod";

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
  send(pushToken: string, notification: PushNotification): Promise<PushResult>;
}

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/** Expo error codes that indicate the device token is no longer valid */
const DEVICE_INACTIVE_ERRORS = ["DeviceNotRegistered", "InvalidCredentials"];

const ExpoTicketSchema = z.object({
  status: z.enum(["ok", "error"]),
  id: z.string().optional(),
  message: z.string().optional(),
  details: z.object({ error: z.string().optional() }).optional(),
});
const ExpoResponseSchema = z.object({ data: z.array(ExpoTicketSchema).min(1) });

/** An Expo push ticket as our result; some errors mean the device's token is gone. */
function resultOf(ticket: z.infer<typeof ExpoTicketSchema>): PushResult {
  if (ticket.status !== "error") {
    return { success: true, providerMessageId: ticket.id, deviceActive: true };
  }
  const errorCode = ticket.details?.error ?? ticket.message ?? "Unknown Expo push error";
  return {
    success: false,
    error: errorCode,
    deviceActive: !DEVICE_INACTIVE_ERRORS.includes(errorCode),
  };
}

/**
 * Expo Push provider — sends notifications via Expo's push service,
 * which handles APNs (iOS) and FCM (Android) delivery.
 */
export class ExpoPushProvider implements PushProvider {
  private accessToken?: string;

  constructor(accessToken?: string) {
    this.accessToken = accessToken;
  }

  async send(pushToken: string, notification: PushNotification): Promise<PushResult> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.accessToken && { Authorization: `Bearer ${this.accessToken}` }),
    };

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
      return resultOf(ExpoResponseSchema.parse(await response.json()).data[0]);
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
  accessToken?: string,
): PushProvider {
  return new ExpoPushProvider(accessToken);
}
