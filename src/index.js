/**
 * AstralyxXP — Discord XP Bot
 * Cloudflare Worker entry point.
 *
 * Routes:
 *   POST /interactions  — Discord interaction endpoint
 *   GET/POST /api/*     — REST API for Minecraft plugin
 *   GET /               — Health check
 */

import { verifyKey } from 'discord-interactions';

// Command handlers
import { execute as balance } from './commands/balance.js';
import { execute as daily } from './commands/daily.js';
import { execute as coinflip } from './commands/coinflip.js';
import { execute as slots } from './commands/slots.js';
import { execute as leaderboard } from './commands/leaderboard.js';
import { execute as transfer } from './commands/transfer.js';
import { execute as setxp } from './commands/setxp.js';
import { execute as addxp } from './commands/addxp.js';
import { execute as removexp } from './commands/removexp.js';
import { execute as minigame } from './commands/minigame.js';

// Game component handlers
import { handleComponent as handleRainingXP } from './games/raining-xp.js';
import { handleComponent as handleGuess } from './games/guess.js';
import { handleComponent as handleFallenXP } from './games/fallen-xp.js';
import { handleComponent as handleLadders } from './games/ladders.js';
import { handleComponent as handleLuckDuck } from './games/luck-duck.js';

// API handler
import { handleAPI } from './api.js';

// Utility
import { jsonResponse } from './utils/discord.js';

/** Map command names to their handler functions. */
const COMMANDS = {
  balance,
  daily,
  coinflip,
  slots,
  leaderboard,
  transfer,
  setxp,
  addxp,
  removexp,
  minigame,
};

/** Map game type prefixes to their component handlers. */
const GAME_HANDLERS = {
  raining_xp: handleRainingXP,
  guess: handleGuess,
  fallen_xp: handleFallenXP,
  ladders: handleLadders,
  luck_duck: handleLuckDuck,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── Health check ──
    if (request.method === 'GET' && url.pathname === '/') {
      return jsonResponse({ status: 'ok', bot: 'AstralyxXP', uptime: 'edge' });
    }

    // ── REST API for Minecraft plugin ──
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env, url);
    }

    // ── Discord interactions endpoint ──
    if (request.method === 'POST' && url.pathname === '/interactions') {
      return handleInteraction(request, env, ctx);
    }

    return jsonResponse({ error: 'Not found' }, 404);
  },
};

/**
 * Verify and route a Discord interaction.
 */
async function handleInteraction(request, env, ctx) {
  // Verify the request signature
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const rawBody = await request.text();

  if (!signature || !timestamp) {
    return jsonResponse({ error: 'Missing signature headers' }, 401);
  }

  const isValid = await verifyKey(rawBody, signature, timestamp, env.DISCORD_PUBLIC_KEY);
  if (!isValid) {
    return jsonResponse({ error: 'Invalid signature' }, 401);
  }

  const interaction = JSON.parse(rawBody);

  // Type 1: PING (Discord verification handshake)
  if (interaction.type === 1) {
    return jsonResponse({ type: 1 });
  }

  // Type 2: APPLICATION_COMMAND (slash commands)
  if (interaction.type === 2) {
    return handleCommand(interaction, env, ctx);
  }

  // Type 3: MESSAGE_COMPONENT (button clicks for minigames)
  if (interaction.type === 3) {
    return handleComponentInteraction(interaction, env, ctx);
  }

  return jsonResponse({ error: 'Unknown interaction type' }, 400);
}

/**
 * Route a slash command to its handler.
 */
async function handleCommand(interaction, env, ctx) {
  const commandName = interaction.data.name;
  const handler = COMMANDS[commandName];

  if (!handler) {
    return jsonResponse({
      type: 4,
      data: { content: '❌ Unknown command.', flags: 64 },
    });
  }

  try {
    return await handler(interaction, env, ctx);
  } catch (error) {
    console.error(`Command /${commandName} error:`, error);
    return jsonResponse({
      type: 4,
      data: { content: '❌ Something went wrong. Please try again later.', flags: 64 },
    });
  }
}

/**
 * Route a component interaction (button click) to the correct game handler.
 * custom_id format: game:{gameType}:{sessionId}:{action}
 */
async function handleComponentInteraction(interaction, env, ctx) {
  const customId = interaction.data?.custom_id || '';

  if (!customId.startsWith('game:')) {
    return jsonResponse({
      type: 4,
      data: { content: '❌ Unknown interaction.', flags: 64 },
    });
  }

  const parts = customId.split(':');
  // parts[0] = "game", parts[1] = gameType, parts[2] = sessionId, parts[3+] = action
  const gameType = parts[1];
  const handler = GAME_HANDLERS[gameType];

  if (!handler) {
    return jsonResponse({
      type: 4,
      data: { content: '❌ Unknown game type.', flags: 64 },
    });
  }

  try {
    return await handler(interaction, env, ctx);
  } catch (error) {
    console.error(`Game component (${gameType}) error:`, error);
    return jsonResponse({
      type: 4,
      data: { content: '❌ Something went wrong with the minigame.', flags: 64 },
    });
  }
}
