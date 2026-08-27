/**
 * D1 database helper functions for user XP management.
 */

/**
 * Ensure a user row exists (INSERT OR IGNORE).
 */
export async function ensureUser(db, discordId) {
  await db
    .prepare('INSERT OR IGNORE INTO users (discord_id, xp, daily_streak) VALUES (?, 0, 0)')
    .bind(discordId)
    .run();
}

/**
 * Get a user row. Creates one if it doesn't exist.
 */
export async function getUser(db, discordId) {
  await ensureUser(db, discordId);
  const row = await db.prepare('SELECT * FROM users WHERE discord_id = ?').bind(discordId).first();
  return row;
}

/**
 * Set a user's XP to an exact value.
 */
export async function setXP(db, discordId, xp) {
  await ensureUser(db, discordId);
  const clamped = Math.max(0, Math.floor(xp));
  await db.prepare('UPDATE users SET xp = ? WHERE discord_id = ?').bind(clamped, discordId).run();
  return clamped;
}

/**
 * Add XP to a user (can be negative for removal). Returns the new total.
 */
export async function addXP(db, discordId, amount) {
  await ensureUser(db, discordId);
  // Use MAX(0, ...) to never go below zero
  await db
    .prepare('UPDATE users SET xp = MAX(0, xp + ?) WHERE discord_id = ?')
    .bind(Math.floor(amount), discordId)
    .run();
  const row = await db.prepare('SELECT xp FROM users WHERE discord_id = ?').bind(discordId).first();
  return row.xp;
}

/**
 * Get leaderboard (top N users by XP).
 */
export async function getLeaderboard(db, limit = 10) {
  const { results } = await db
    .prepare('SELECT discord_id, xp FROM users WHERE xp > 0 ORDER BY xp DESC LIMIT ?')
    .bind(limit)
    .all();
  return results;
}

/**
 * Update daily claim timestamp and streak.
 */
export async function updateDaily(db, discordId, streak) {
  await db
    .prepare('UPDATE users SET daily_last_claimed = ?, daily_streak = ? WHERE discord_id = ?')
    .bind(new Date().toISOString(), streak, discordId)
    .run();
}

/**
 * Get linked Minecraft account for a Discord user.
 */
export async function getLinkedAccount(db, discordId) {
  return await db
    .prepare('SELECT * FROM linked_accounts WHERE discord_id = ?')
    .bind(discordId)
    .first();
}

/**
 * Get linked account by Minecraft UUID.
 */
export async function getLinkedByUUID(db, minecraftUuid) {
  return await db
    .prepare('SELECT * FROM linked_accounts WHERE minecraft_uuid = ?')
    .bind(minecraftUuid)
    .first();
}

/**
 * Link a Discord account to a Minecraft account.
 */
export async function linkAccount(db, discordId, minecraftUuid, minecraftName) {
  await db
    .prepare(
      'INSERT OR REPLACE INTO linked_accounts (discord_id, minecraft_uuid, minecraft_name, linked_at) VALUES (?, ?, ?, ?)'
    )
    .bind(discordId, minecraftUuid, minecraftName, new Date().toISOString())
    .run();
}

/**
 * Transfer XP between users atomically using a D1 batch.
 */
export async function transferXP(db, fromId, toId, amount) {
  await ensureUser(db, fromId);
  await ensureUser(db, toId);

  const sender = await getUser(db, fromId);
  if (sender.xp < amount) {
    throw new Error('Insufficient XP');
  }

  await db.batch([
    db.prepare('UPDATE users SET xp = xp - ? WHERE discord_id = ?').bind(amount, fromId),
    db.prepare('UPDATE users SET xp = xp + ? WHERE discord_id = ?').bind(amount, toId),
  ]);

  return { newSenderXP: sender.xp - amount, newReceiverXP: (await getUser(db, toId)).xp };
}
