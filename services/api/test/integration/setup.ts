import { env } from "cloudflare:test";

// Apply schema directly (Workers runtime doesn't have filesystem access)
const schema = `
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

CREATE TABLE IF NOT EXISTS cast_sessions (
  session_id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  view_url TEXT NOT NULL,
  stream_session_id TEXT,
  stream_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'idle', 'ended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_devices_push_token ON devices(push_token);
CREATE INDEX IF NOT EXISTS idx_api_keys_game_id ON api_keys(game_id);
CREATE INDEX IF NOT EXISTS idx_cast_sessions_game_id ON cast_sessions(game_id);
`;

// Execute each statement
const statements = schema
  .split(";")
  .map((s: string) => s.trim())
  .filter((s: string) => s.length > 0);

for (const stmt of statements) {
  await env.DB.prepare(stmt).run();
}

// Seed test API key
await env.DB.prepare(
  "INSERT OR IGNORE INTO api_keys (key, game_id, game_name) VALUES (?, ?, ?)"
)
  .bind("test-api-key", "trivia-jam", "Trivia Jam")
  .run();
