CREATE TABLE IF NOT EXISTS devices (
  ogs_device_id TEXT PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  push_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_keys (
  key TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  game_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_devices_push_token ON devices(push_token);
CREATE INDEX IF NOT EXISTS idx_api_keys_game_id ON api_keys(game_id);
