import type {
  BulkSendNotificationParams,
  NotificationError,
  NotificationResult,
  SendNotificationParams,
} from "@open-game-system/notification-kit-core";

export interface NotificationClientConfig {
  apiKey: string;
  baseUrl?: string;
}

export class NotificationApiError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(error: NotificationError) {
    super(error.message);
    this.name = "NotificationApiError";
    this.code = error.code;
    this.status = error.status;
  }
}

export function createNotificationClient(config: NotificationClientConfig) {
  const baseUrl = config.baseUrl ?? "https://api.opengame.org";

  async function request<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data: unknown = await response.json();

    if (!response.ok) {
      const errorBody = data as { error?: NotificationError };
      throw new NotificationApiError(
        errorBody.error ?? {
          code: "unknown_error",
          message: `HTTP ${response.status}`,
          status: response.status,
        },
      );
    }

    return data as T;
  }

  return {
    async sendNotification(params: SendNotificationParams): Promise<NotificationResult> {
      return request<NotificationResult>("/api/v1/notifications/send", params);
    },

    async sendBulkNotifications(params: BulkSendNotificationParams): Promise<NotificationResult[]> {
      const results = await Promise.allSettled(
        params.deviceIds.map((deviceId) =>
          request<NotificationResult>("/api/v1/notifications/send", {
            deviceId,
            notification: params.notification,
          }),
        ),
      );

      return results.map((result) => {
        if (result.status === "fulfilled") return result.value;
        return { id: "", status: "failed" as const };
      });
    },
  };
}

export type NotificationClient = ReturnType<typeof createNotificationClient>;
