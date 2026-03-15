import type { StreamContainer } from "./stream-container";

export interface Env {
  DB: D1Database;
  OGS_JWT_SECRET: string;
  STREAM_CONTAINER: DurableObjectNamespace<StreamContainer>;
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

export interface CastSessionRow {
  session_id: string;
  game_id: string;
  device_id: string;
  view_url: string;
  stream_session_id: string | null;
  stream_url: string | null;
  status: "pending" | "active" | "idle" | "ended";
  created_at: string;
  updated_at: string;
}
