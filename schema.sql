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

-- Idempotent Minecraft-server rewards for account XP. Events are keyed by
-- Minecraft UUID so server retries cannot duplicate a kill or minigame award.
CREATE TABLE IF NOT EXISTS minecraft_reward_events (
  minecraft_uuid TEXT NOT NULL,
  event_id TEXT NOT NULL,
  discord_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  kills_after INTEGER,
  PRIMARY KEY (minecraft_uuid, event_id)
);

CREATE TABLE IF NOT EXISTS minecraft_stats (
  minecraft_uuid TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL,
  kills INTEGER NOT NULL DEFAULT 0
);

CREATE TRIGGER IF NOT EXISTS minecraft_reward_add_xp
AFTER INSERT ON minecraft_reward_events
BEGIN
  UPDATE users SET xp = MAX(0, xp + NEW.amount) WHERE discord_id = NEW.discord_id;
END;

CREATE TRIGGER IF NOT EXISTS minecraft_kill_update_stats
AFTER INSERT ON minecraft_reward_events
WHEN NEW.reason = 'kill'
BEGIN
  INSERT INTO minecraft_stats (minecraft_uuid, discord_id, kills)
  VALUES (NEW.minecraft_uuid, NEW.discord_id, 1)
  ON CONFLICT(minecraft_uuid) DO UPDATE SET
    discord_id = excluded.discord_id,
    kills = minecraft_stats.kills + 1;

  UPDATE minecraft_reward_events
  SET kills_after = (SELECT kills FROM minecraft_stats WHERE minecraft_uuid = NEW.minecraft_uuid)
  WHERE minecraft_uuid = NEW.minecraft_uuid AND event_id = NEW.event_id;
END;

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_users_xp ON users(xp DESC);

-- Index for looking up linked accounts by Minecraft UUID
CREATE INDEX IF NOT EXISTS idx_linked_minecraft ON linked_accounts(minecraft_uuid);

CREATE INDEX IF NOT EXISTS idx_minecraft_rewards_discord
  ON minecraft_reward_events(discord_id, created_at);
