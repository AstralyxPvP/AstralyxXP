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

import { getUser, getLinkedAccount, getLinkedByUUID, linkAccount, ensureUser, addXP, setXP, transferXP, updateDaily } from './utils/db.js';
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

  // POST /api/coinflip — body: { discord_id, choice, amount }
  if (path === '/api/coinflip' && request.method === 'POST') {
    try {
      const { discord_id, choice, amount } = await request.json();
      if (!discord_id || (choice !== 'heads' && choice !== 'tails') || !Number.isFinite(amount)) {
        return jsonResponse({ error: 'Invalid request' }, 400);
      }
      if (amount < 10 || amount > 5000) {
        return jsonResponse({ error: 'Amount must be between 10 and 5000 XP.' }, 400);
      }

      await ensureUser(db, discord_id);
      const user = await getUser(db, discord_id);
      if (user.xp < amount) {
        return jsonResponse({ error: 'Insufficient XP', xp: user.xp }, 400);
      }

      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      const result = buf[0] % 2 === 0 ? 'heads' : 'tails';
      const win = result === choice;
      const newXp = win ? await addXP(db, discord_id, amount) : await setXP(db, discord_id, user.xp - amount);
      const progress = getProgress(newXp);

      return jsonResponse({
        result,
        win,
        amount,
        xp: newXp,
        level: progress.level,
        next_level_xp: progress.nextThreshold,
        progress: Math.round(progress.progress * 100),
      });
    } catch (error) {
      console.error('Coinflip error:', error);
      return jsonResponse({ error: 'Failed to play' }, 500);
    }
  }

  // POST /api/slots — body: { discord_id, amount }
  if (path === '/api/slots' && request.method === 'POST') {
    try {
      const { discord_id, amount } = await request.json();
      if (!discord_id || !Number.isFinite(amount)) {
        return jsonResponse({ error: 'Invalid request' }, 400);
      }
      if (amount < 10 || amount > 5000) {
        return jsonResponse({ error: 'Amount must be between 10 and 5000 XP.' }, 400);
      }

      await ensureUser(db, discord_id);
      const user = await getUser(db, discord_id);
      if (user.xp < amount) {
        return jsonResponse({ error: 'Insufficient XP', xp: user.xp }, 400);
      }

      const symbols = ['🍒', '🍋', '🔔', '💎', '⭐', '7️⃣'];
      const buf = new Uint32Array(3);
      crypto.getRandomValues(buf);
      const s1 = symbols[buf[0] % symbols.length];
      const s2 = symbols[buf[1] % symbols.length];
      const s3 = symbols[buf[2] % symbols.length];

      let winAmount = -amount;
      let jackpot = false;
      let pair = false;
      if (s1 === s2 && s2 === s3) {
        winAmount = amount * 5;
        jackpot = true;
      } else if (s1 === s2 || s2 === s3 || s1 === s3) {
        pair = true;
      }

      const newXp = await addXP(db, discord_id, winAmount);
      const progress = getProgress(newXp);

      return jsonResponse({
        symbols: [s1, s2, s3],
        jackpot,
        pair,
        win_amount: winAmount,
        amount,
        xp: newXp,
        level: progress.level,
        next_level_xp: progress.nextThreshold,
        progress: Math.round(progress.progress * 100),
      });
    } catch (error) {
      console.error('Slots error:', error);
      return jsonResponse({ error: 'Failed to play' }, 500);
    }
  }

  // POST /api/daily — body: { discord_id }
  if (path === '/api/daily' && request.method === 'POST') {
    try {
      const { discord_id } = await request.json();
      if (!discord_id) {
        return jsonResponse({ error: 'Invalid request' }, 400);
      }

      await ensureUser(db, discord_id);
      const user = await getUser(db, discord_id);

      const now = Date.now();
      const lastClaimed = user.daily_last_claimed ? new Date(user.daily_last_claimed).getTime() : 0;
      const hoursSinceLast = (now - lastClaimed) / (1000 * 60 * 60);

      if (hoursSinceLast < 24) {
        const hoursRemaining = 24 - hoursSinceLast;
        return jsonResponse({
          error: 'On cooldown',
          hours: Math.floor(hoursRemaining),
          minutes: Math.floor((hoursRemaining * 60) % 60),
        }, 429);
      }

      let streak = user.daily_streak || 0;
      if (hoursSinceLast <= 48) {
        streak += 1;
      } else {
        streak = 1;
      }

      const baseReward = 10;
      const bonus = Math.floor(streak / 3) * 5;
      const reward = baseReward + bonus;

      await updateDaily(db, discord_id, streak);
      const newXp = await addXP(db, discord_id, reward);
      const progress = getProgress(newXp);

      return jsonResponse({
        reward,
        streak,
        xp: newXp,
        level: progress.level,
        next_level_xp: progress.nextThreshold,
        progress: Math.round(progress.progress * 100),
      });
    } catch (error) {
      console.error('Daily error:', error);
      return jsonResponse({ error: 'Failed to claim' }, 500);
    }
  }

  // POST /api/transfer — body: { from, to, amount }
  if (path === '/api/transfer' && request.method === 'POST') {
    try {
      const { from, to, amount } = await request.json();
      if (!from || !to || !Number.isFinite(amount)) {
        return jsonResponse({ error: 'Invalid request' }, 400);
      }
      if (amount < 1) {
        return jsonResponse({ error: 'Amount must be at least 1 XP.' }, 400);
      }
      if (from === to) {
        return jsonResponse({ error: 'You cannot transfer XP to yourself.' }, 400);
      }

      await ensureUser(db, from);
      await ensureUser(db, to);
      const sender = await getUser(db, from);
      if (sender.xp < amount) {
        return jsonResponse({ error: 'Insufficient XP', xp: sender.xp }, 400);
      }

      const result = await transferXP(db, from, to, amount);
      return jsonResponse({ success: true, ...result });
    } catch (error) {
      console.error('Transfer error:', error);
      return jsonResponse({ error: 'Transfer failed' }, 500);
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
