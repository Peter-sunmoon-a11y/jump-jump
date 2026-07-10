PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS players (
  player_id TEXT PRIMARY KEY,
  device_id_hash TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  plays INTEGER NOT NULL DEFAULT 6,
  balance_cents INTEGER NOT NULL DEFAULT 888,
  xp INTEGER NOT NULL DEFAULT 860,
  total_reward_cents INTEGER NOT NULL DEFAULT 240,
  highest_block INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS active_rounds (
  round_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL UNIQUE,
  seed INTEGER NOT NULL,
  practice INTEGER NOT NULL DEFAULT 0,
  config_version TEXT NOT NULL,
  seed_proof TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);

CREATE TABLE IF NOT EXISTS rounds (
  round_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  block INTEGER NOT NULL,
  end_reason TEXT NOT NULL,
  rewards_json TEXT NOT NULL,
  base_reward_cents INTEGER NOT NULL,
  bonus_reward_cents INTEGER NOT NULL,
  xp_earned INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  FOREIGN KEY (player_id) REFERENCES players(player_id)
);

CREATE TABLE IF NOT EXISTS balance_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  type TEXT NOT NULL,
  round_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS play_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  change_amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  round_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS extension_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  round_id TEXT NOT NULL,
  blocks INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rounds_player ON rounds(player_id, ended_at DESC);
CREATE INDEX IF NOT EXISTS idx_rounds_week ON rounds(ended_at, player_id);
CREATE INDEX IF NOT EXISTS idx_balance_player ON balance_ledger(player_id, created_at DESC);
