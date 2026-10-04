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

-- Profiles (OGS profiles slice 1, docs/product-specs/ogs-profiles.html). One profile per device.
-- handle: unique @id without the "@". library: JSON array of catalogue app ids; NULL = whole catalogue.
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sticker TEXT NOT NULL,
  library TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The phone or tablet a profile is on. A device signing in to another profile moves to it.
CREATE TABLE IF NOT EXISTS profile_devices (
  device_id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  kind TEXT NOT NULL CHECK (kind IN ('phone', 'tablet')),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Back-up logins: Apple / Google (OIDC subject) or email (lowercased address). One profile each.
CREATE TABLE IF NOT EXISTS profile_logins (
  provider TEXT NOT NULL CHECK (provider IN ('apple', 'google', 'email')),
  subject TEXT NOT NULL,
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (provider, subject)
);

-- Pending email sign-in codes: SHA-256 of the 6-digit code, expiry in ms, failed attempts.
CREATE TABLE IF NOT EXISTS email_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

-- Push switches per profile (1 = on). A missing row means all on.
CREATE TABLE IF NOT EXISTS notification_settings (
  profile_id TEXT PRIMARY KEY REFERENCES profiles(id),
  friend_casting INTEGER NOT NULL DEFAULT 1,
  friend_joined INTEGER NOT NULL DEFAULT 1,
  your_turn INTEGER NOT NULL DEFAULT 1
);

-- Couch sessions: one per cast, owned by the caster (host). code: the TV code others join with.
-- created_at: ms since epoch (a session lives as long as its 12 h launcher token).
CREATE TABLE IF NOT EXISTS couch_sessions (
  id TEXT PRIMARY KEY,
  host_profile_id TEXT NOT NULL REFERENCES profiles(id),
  code TEXT NOT NULL UNIQUE,
  tv_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session_members (
  session_id TEXT NOT NULL REFERENCES couch_sessions(id),
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (session_id, profile_id)
);

-- Instances: one sitting of one game for one profile (ogs-protocol InstanceSchema).
-- your_turn: NULL (not reported), 0 or 1. starts_at and updated_at: ms since epoch.
CREATE TABLE IF NOT EXISTS instances (
  profile_id TEXT NOT NULL REFERENCES profiles(id),
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
  PRIMARY KEY (profile_id, instance_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_devices_profile ON profile_devices(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_logins_profile ON profile_logins(profile_id);
