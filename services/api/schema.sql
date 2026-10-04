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
CREATE INDEX IF NOT EXISTS idx_cast_sessions_status ON cast_sessions(status);

-- Households (OGS app v3 identity): a family, its people and its paired devices.
-- library: JSON array of catalogue app ids the household keeps; NULL means the whole catalogue.
CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  library TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS household_people (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  name TEXT NOT NULL,
  band TEXT NOT NULL CHECK (band IN ('grownup', 'kid', 'little')),
  sticker TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS household_devices (
  device_id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  kind TEXT NOT NULL CHECK (kind IN ('phone', 'tablet', 'launcher')),
  person_id TEXT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Instances: one sitting of one game for one household (ogs-protocol InstanceSchema).
-- your_turn: NULL (not reported), 0 or 1. starts_at and updated_at: ms since epoch.
CREATE TABLE IF NOT EXISTS instances (
  household_id TEXT NOT NULL REFERENCES households(id),
  instance_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('lobby', 'active', 'suspended', 'waiting', 'completed', 'expired')),
  title TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  your_turn INTEGER,
  starts_at INTEGER,
  resume_url TEXT,
  source TEXT NOT NULL CHECK (source IN ('bridge', 'server', 'visit')),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (household_id, instance_id)
);

CREATE INDEX IF NOT EXISTS idx_household_people_household ON household_people(household_id);
CREATE INDEX IF NOT EXISTS idx_household_devices_household ON household_devices(household_id);
