export interface NotificationKitConfig {
  debug?: boolean;
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface SendNotificationParams {
  deviceId: string;
  notification: NotificationPayload;
}

export interface BulkSendNotificationParams {
  deviceIds: string[];
  notification: NotificationPayload;
}

export interface NotificationResult {
  id: string;
  status: 'sent' | 'failed';
}

export interface NotificationError {
  code: string;
  message: string;
  status: number;
}
