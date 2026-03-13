export interface Env {
  DB: D1Database;
}

export interface DeviceRow {
  ogs_device_id: string;
  platform: "ios" | "android";
  push_token: string;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyRow {
  key: string;
  game_id: string;
  game_name: string;
  created_at: string;
}

export interface RegisterDeviceRequest {
  ogsDeviceId: string;
  platform: "ios" | "android";
  pushToken: string;
}

export interface SendNotificationRequest {
  deviceId: string;
  notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
  };
}
