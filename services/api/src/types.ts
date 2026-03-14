export interface Env {
  DB: D1Database;
  OGS_JWT_SECRET: string;
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
