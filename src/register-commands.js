/**
 * Register all AstralyxXP slash commands with the Discord API.
 * Run once with: node src/register-commands.js
 * Requires .env with DISCORD_APPLICATION_ID and DISCORD_TOKEN.
 */

import 'dotenv/config';

const commands = [
  {
    name: 'balance',
    description: 'Check your XP, level, and progress',
    options: [
      {
        name: 'user',
        description: 'Check another user\'s balance',
        type: 6, // USER
        required: false,
      },
    ],
  },
  {
    name: 'daily',
    description: 'Claim your daily XP reward (streaks increase the bonus!)',
  },
  {
    name: 'coinflip',
    description: 'Bet XP on a coin flip',
    options: [
      {
        name: 'amount',
        description: 'Amount of XP to bet (10–5000)',
        type: 4, // INTEGER
        required: true,
        min_value: 10,
        max_value: 5000,
      },
      {
        name: 'choice',
        description: 'Heads or tails?',
        type: 3, // STRING
        required: true,
        choices: [
          { name: 'Heads', value: 'heads' },
          { name: 'Tails', value: 'tails' },
        ],
      },
    ],
  },
  {
    name: 'slots',
    description: 'Bet XP on the slot machine',
    options: [
      {
        name: 'amount',
        description: 'Amount of XP to bet (10–5000)',
        type: 4, // INTEGER
        required: true,
        min_value: 10,
        max_value: 5000,
      },
    ],
  },
  {
    name: 'leaderboard',
    description: 'View the top XP earners',
    options: [
      {
        name: 'count',
        description: 'Number of players to show (default 10, max 25)',
        type: 4, // INTEGER
        required: false,
        min_value: 1,
        max_value: 25,
      },
    ],
  },
  {
    name: 'transfer',
    description: 'Transfer XP to another player',
    options: [
      {
        name: 'user',
        description: 'Who to send XP to',
        type: 6, // USER
        required: true,
      },
      {
        name: 'amount',
        description: 'Amount of XP to transfer',
        type: 4, // INTEGER
        required: true,
        min_value: 1,
      },
    ],
  },
  {
    name: 'setxp',
    description: '[Staff] Set a user\'s XP to an exact amount',
    options: [
      {
        name: 'user',
        description: 'Target user',
        type: 6,
        required: true,
      },
      {
        name: 'amount',
        description: 'XP amount to set',
        type: 4,
        required: true,
        min_value: 0,
      },
    ],
  },
  {
    name: 'addxp',
    description: '[Staff] Add XP to a user',
    options: [
      {
        name: 'user',
        description: 'Target user',
        type: 6,
        required: true,
      },
      {
        name: 'amount',
        description: 'Amount of XP to add',
        type: 4,
        required: true,
        min_value: 1,
      },
    ],
  },
  {
    name: 'removexp',
    description: '[Staff] Remove XP from a user',
    options: [
      {
        name: 'user',
        description: 'Target user',
        type: 6,
        required: true,
      },
      {
        name: 'amount',
        description: 'Amount of XP to remove',
        type: 4,
        required: true,
        min_value: 1,
      },
    ],
  },
  {
    name: 'minigame',
    description: '[Staff] Trigger a random XP minigame in this channel',
  },
];

const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
const BOT_TOKEN = process.env.DISCORD_TOKEN;

if (!APPLICATION_ID || !BOT_TOKEN) {
  console.error('❌ Missing DISCORD_APPLICATION_ID or DISCORD_TOKEN in .env');
  process.exit(1);
}

const url = `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`;

console.log(`📡 Registering ${commands.length} commands for application ${APPLICATION_ID}...`);

const response = await fetch(url, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bot ${BOT_TOKEN}`,
  },
  body: JSON.stringify(commands),
});

if (response.ok) {
  const data = await response.json();
  const names = data.map((c) => `/${c.name}`).join(', ');
  console.log(`✅ Successfully registered: ${names}`);
} else {
  console.error(`❌ Registration failed: ${response.status}`);
  console.error(await response.text());
  process.exit(1);
}
