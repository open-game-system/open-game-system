export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface PushProvider {
  send(
    pushToken: string,
    notification: PushNotification
  ): Promise<PushResult>;
}

/**
 * Stub APNs provider for iOS push notifications.
 * Logs what would be sent; replace with real APNs integration later.
 */
export class ApnsProvider implements PushProvider {
  async send(
    pushToken: string,
    notification: PushNotification
  ): Promise<PushResult> {
    console.log("[APNs STUB] Would send to token:", pushToken, notification);
    return {
      success: true,
      providerMessageId: `apns-stub-${Date.now()}`,
    };
  }
}

/**
 * Stub FCM provider for Android push notifications.
 * Logs what would be sent; replace with real FCM integration later.
 */
export class FcmProvider implements PushProvider {
  async send(
    pushToken: string,
    notification: PushNotification
  ): Promise<PushResult> {
    console.log("[FCM STUB] Would send to token:", pushToken, notification);
    return {
      success: true,
      providerMessageId: `fcm-stub-${Date.now()}`,
    };
  }
}

export function getProviderForPlatform(
  platform: "ios" | "android"
): PushProvider {
  switch (platform) {
    case "ios":
      return new ApnsProvider();
    case "android":
      return new FcmProvider();
  }
}
