-- AstralyxXP D1 Database Schema

-- Core XP data for every Discord user
CREATE TABLE IF NOT EXISTS users (
  discord_id TEXT PRIMARY KEY,
  xp INTEGER NOT NULL DEFAULT 0,
  daily_last_claimed TEXT,
  daily_streak INTEGER NOT NULL DEFAULT 0
);

-- Account linking (Discord ↔ Minecraft)
CREATE TABLE IF NOT EXISTS linked_accounts (
  discord_id TEXT PRIMARY KEY,
  minecraft_uuid TEXT NOT NULL UNIQUE,
  minecraft_name TEXT NOT NULL,
  linked_at TEXT NOT NULL
);

-- Active minigame sessions (cleaned up after game ends)
CREATE TABLE IF NOT EXISTS minigame_sessions (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  game_type TEXT NOT NULL,
  message_id TEXT,
  xp_reward INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT '{}',
  winner_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_users_xp ON users(xp DESC);

-- Index for looking up linked accounts by Minecraft UUID
CREATE INDEX IF NOT EXISTS idx_linked_minecraft ON linked_accounts(minecraft_uuid);
