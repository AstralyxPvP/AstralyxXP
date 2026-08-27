/**
 * REST API for the Minecraft plugin to query XP data and manage account linking.
 *
 * Endpoints:
 *   GET  /api/xp/:discordId       — Get XP and level for a Discord user
 *   GET  /api/linked/:uuid        — Get linked Discord user by Minecraft UUID
 *   POST /api/link                — Link a Discord account to a Minecraft account
 *
 * All endpoints require: Authorization: Bearer <API_SECRET>
 */

import { getUser, getLinkedAccount, getLinkedByUUID, linkAccount, ensureUser } from './utils/db.js';
import { getLevel, getProgress } from './utils/levels.js';
import { jsonResponse } from './utils/discord.js';

/**
 * Handle API requests from the Minecraft plugin.
 */
export async function handleAPI(request, env, url) {
  // Authenticate
  const authHeader = request.headers.get('Authorization');
  const expected = `Bearer ${env.API_SECRET}`;
  if (!env.API_SECRET || authHeader !== expected) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const path = url.pathname;
  const db = env.astralyx_xp;

  // GET /api/xp/:discordId
  const xpMatch = path.match(/^\/api\/xp\/(\d+)$/);
  if (xpMatch && request.method === 'GET') {
    const discordId = xpMatch[1];
    const user = await getUser(db, discordId);
    const progress = getProgress(user.xp);
    return jsonResponse({
      discord_id: discordId,
      xp: user.xp,
      level: progress.level,
      next_level_xp: progress.nextThreshold,
      progress: Math.round(progress.progress * 100),
    });
  }

  // GET /api/linked/:uuid
  const linkedMatch = path.match(/^\/api\/linked\/([a-f0-9-]+)$/i);
  if (linkedMatch && request.method === 'GET') {
    const uuid = linkedMatch[1];
    const linked = await getLinkedByUUID(db, uuid);
    if (!linked) {
      return jsonResponse({ error: 'No linked account found' }, 404);
    }
    const user = await getUser(db, linked.discord_id);
    const progress = getProgress(user.xp);
    return jsonResponse({
      discord_id: linked.discord_id,
      minecraft_uuid: linked.minecraft_uuid,
      minecraft_name: linked.minecraft_name,
      xp: user.xp,
      level: progress.level,
      linked_at: linked.linked_at,
    });
  }

  // POST /api/link — body: { discord_id, minecraft_uuid, minecraft_name }
  if (path === '/api/link' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { discord_id, minecraft_uuid, minecraft_name } = body;

      if (!discord_id || !minecraft_uuid || !minecraft_name) {
        return jsonResponse({ error: 'Missing required fields: discord_id, minecraft_uuid, minecraft_name' }, 400);
      }

      await ensureUser(db, discord_id);
      await linkAccount(db, discord_id, minecraft_uuid, minecraft_name);

      return jsonResponse({ success: true, message: 'Account linked successfully' });
    } catch (error) {
      console.error('Link error:', error);
      return jsonResponse({ error: 'Failed to link account' }, 500);
    }
  }

  // GET /api/leaderboard?limit=10
  if (path === '/api/leaderboard' && request.method === 'GET') {
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10', 10), 50);
    const { results } = await db
      .prepare('SELECT discord_id, xp FROM users WHERE xp > 0 ORDER BY xp DESC LIMIT ?')
      .bind(limit)
      .all();

    const board = results.map((row, i) => ({
      rank: i + 1,
      discord_id: row.discord_id,
      xp: row.xp,
      level: getLevel(row.xp),
    }));

    return jsonResponse({ leaderboard: board });
  }

  return jsonResponse({ error: 'Not found' }, 404);
}
