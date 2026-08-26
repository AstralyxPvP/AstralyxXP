import { verify } from "./crypto";

const MAIN_GUILD_ID = "1477025023800901766";
const OWNER_ID = "1513925512118931551";
const OWNER_STARTING_XP = 10;

const STAFF_ROLES = [
  "1477025238784151554", // Owner
  "1477291491003994214", // Co-Owner
  "1502815102716608552", // Chief Manager
  "1497335106074050620", // Sr. Manager
  "1483209618485284964", // Manager
  "1497316294632931358", // Developer
  "1497316250945323070", // Admin
  "1497316120452136960", // Sr. Mod
  "1477025502119334109", // Mod
];

const LEVELS = [
  { level: 0, xp: 0 },
  { level: 1, xp: 10 },
  { level: 2, xp: 20 },
  { level: 3, xp: 50 },
  { level: 4, xp: 100 },
  { level: 5, xp: 200 },
  { level: 6, xp: 350 },
  { level: 7, xp: 500 },
  { level: 8, xp: 750 },
  { level: 9, xp: 1000 },
  { level: 10, xp: 1500 },
  { level: 11, xp: 2200 },
  { level: 12, xp: 3000 },
  { level: 13, xp: 4000 },
  { level: 14, xp: 5500 },
  { level: 15, xp: 7500 },
];

const DAILY_REWARDS = [5, 10, 15, 20, 25, 30, 40];
const DAILY_STREAK_BONUS = 5;

function getLevelForXp(xp: number): number {
  let level = 0;
  for (const l of LEVELS) {
    if (xp >= l.xp) level = l.level;
  }
  return level;
}

function getLevelProgress(xp: number) {
  const level = getLevelForXp(xp);
  const currentReq = LEVELS.find((l) => l.level === level)?.xp ?? 0;
  const nextReq = LEVELS.find((l) => l.level === level + 1)?.xp ?? currentReq;
  return { level, current: xp - currentReq, next: nextReq - currentReq };
}

function makeBar(current: number, total: number, len = 20): string {
  const filled = total > 0 ? Math.round((current / total) * len) : 0;
  return "█".repeat(Math.min(filled, len)) + "░".repeat(Math.max(len - filled, 0));
}

async function ensureUser(db: D1Database, userId: string) {
  const existing = await db
    .prepare("SELECT * FROM users WHERE user_id = ?")
    .bind(userId)
    .first();
  if (existing) return existing as any;

  const startingXp = userId === OWNER_ID ? OWNER_STARTING_XP : 0;
  await db
    .prepare("INSERT INTO users (user_id, xp, coins, daily_streak, last_daily) VALUES (?, ?, 50, 0, 0)")
    .bind(userId, startingXp)
    .run();
  return { user_id: userId, xp: startingXp, coins: 50, daily_streak: 0, last_daily: 0 };
}

function isStaff(memberRoles: string[]): boolean {
  return memberRoles.some((r) => STAFF_ROLES.includes(r));
}

function jsonResp(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function embedResp(type: 4 | 5, embed: any): Response {
  return jsonResp({ type, data: { embeds: [embed] } });
}

function errorResp(msg: string): Response {
  return jsonResp({ type: 4, data: { content: msg, flags: 64 } });
}

function interactionEmbed(title: string, color: number, fields: any[], footer?: string) {
  return {
    title,
    color,
    fields,
    footer: { text: footer || "Astralyx XP" },
    timestamp: new Date().toISOString(),
  };
}

// ==================== HANDLERS ====================

async function handleBalance(db: D1Database, interaction: DiscordInteraction): Promise<Response> {
  const targetOpt = interaction.data?.options?.find((o: any) => o.name === "user");
  const targetId = targetOpt?.value || interaction.member?.user?.id;
  const user = await ensureUser(db, targetId);
  const progress = getLevelProgress(user.xp);
  const bar = makeBar(progress.current, progress.next);
  const isSelf = targetId === interaction.member?.user?.id;

  return embedResp(4, interactionEmbed(
    isSelf ? "Your Balance" : `Balance for <@${targetId}>`,
    0x5865f2,
    [
      { name: "Level", value: `${progress.level}`, inline: true },
      { name: "XP", value: `${user.xp}`, inline: true },
      { name: "Coins", value: `${user.coins}`, inline: true },
      { name: "Progress", value: `\`${bar}\` ${progress.current}/${progress.next} XP` },
    ]
  ));
}

async function handleDaily(db: D1Database, userId: string): Promise<Response> {
  const user = await ensureUser(db, userId);
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const lastDaily = user.last_daily || 0;

  if (now - lastDaily < oneDayMs) {
    const next = new Date(lastDaily + oneDayMs);
    return errorResp(`You already claimed today! Come back at <t:${Math.floor(next.getTime() / 1000)}:R>`);
  }

  const yesterday = now - oneDayMs;
  const streakBroken = now - lastDaily > 2 * oneDayMs;
  const newStreak = streakBroken ? 1 : (user.daily_streak || 0) + 1;

  const tierIndex = Math.min(Math.floor((newStreak - 1) / 2), DAILY_REWARDS.length - 1);
  const baseReward = DAILY_REWARDS[tierIndex];
  const streakBonus = newStreak >= 3 ? DAILY_STREAK_BONUS * Math.floor(newStreak / 3) : 0;
  const totalReward = baseReward + streakBonus;

  await db
    .prepare("UPDATE users SET coins = coins + ?, daily_streak = ?, last_daily = ? WHERE user_id = ?")
    .bind(totalReward, newStreak, now, userId)
    .run();

  const fields = [
    { name: "Coins Earned", value: `+${totalReward} coins`, inline: true },
    { name: "Total Coins", value: `${user.coins + totalReward}`, inline: true },
    { name: "Streak", value: `${newStreak} days`, inline: true },
  ];
  if (streakBonus > 0) fields.push({ name: "Streak Bonus", value: `+${streakBonus}`, inline: true });

  return embedResp(4, interactionEmbed("Daily Reward Claimed!", 0x2ecc71, fields));
}

async function handleCoinflip(db: D1Database, userId: string, amount: number, side: string): Promise<Response> {
  if (amount <= 0) return errorResp("Amount must be positive!");
  const user = await ensureUser(db, userId);
  if (user.coins < amount) return errorResp(`You only have ${user.coins} coins!`);

  const result = Math.random() < 0.5 ? "heads" : "tails";
  const won = result === side;
  const winAmount = won ? amount : -amount;

  await db
    .prepare("UPDATE users SET coins = coins + ? WHERE user_id = ?")
    .bind(winAmount, userId)
    .run();

  const color = won ? 0x2ecc71 : 0xe74c3c;
  return embedResp(4, interactionEmbed(
    won ? "You Won!" : "You Lost!",
    color,
    [
      { name: "Your Bet", value: `${amount} coins on **${side}**`, inline: true },
      { name: "Result", value: `**${result}**`, inline: true },
      { name: "Outcome", value: won ? `+${amount} coins` : `-${amount} coins`, inline: true },
      { name: "Balance", value: `${user.coins + winAmount} coins`, inline: true },
    ]
  ));
}

async function handleSlots(db: D1Database, userId: string, amount: number): Promise<Response> {
  if (amount <= 0) return errorResp("Amount must be positive!");
  const user = await ensureUser(db, userId);
  if (user.coins < amount) return errorResp(`You only have ${user.coins} coins!`);

  const symbols = ["🍒", "🍋", "🍊", "🍇", "💎", "7️⃣"];
  const weights = [30, 25, 20, 15, 7, 3];
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  function pickSymbol(): string {
    let r = Math.random() * totalWeight;
    for (let i = 0; i < symbols.length; i++) {
      r -= weights[i];
      if (r <= 0) return symbols[i];
    }
    return symbols[0];
  }

  const s1 = pickSymbol();
  const s2 = pickSymbol();
  const s3 = pickSymbol();

  let multiplier = 0;
  if (s1 === s2 && s2 === s3) {
    multiplier = s1 === "7️⃣" ? 10 : s1 === "💎" ? 7 : 5;
  } else if (s1 === s2 || s2 === s3 || s1 === s3) {
    multiplier = 2;
  }

  const winAmount = amount * multiplier;
  const net = winAmount - amount;
  await db.prepare("UPDATE users SET coins = coins + ? WHERE user_id = ?").bind(net, userId).run();

  const slots = `[ ${s1} | ${s2} | ${s3} ]`;
  return embedResp(4, interactionEmbed(
    multiplier > 0 ? "Slot Machine Win!" : "Slot Machine Lose!",
    multiplier > 0 ? 0x2ecc71 : 0xe74c3c,
    [
      { name: "Slots", value: `\`\`\`${slots}\`\`\``, inline: false },
      { name: "Bet", value: `${amount} coins`, inline: true },
      { name: "Multiplier", value: multiplier > 0 ? `${multiplier}x` : "0x", inline: true },
      { name: "Net", value: net >= 0 ? `+${net}` : `${net}`, inline: true },
      { name: "Balance", value: `${user.coins + net} coins`, inline: true },
    ]
  ));
}

async function handleLeaderboard(db: D1Database): Promise<Response> {
  const rows = await db.prepare("SELECT user_id, xp, coins FROM users ORDER BY xp DESC LIMIT 10").all();
  const results = (rows.results || []) as any[];

  if (results.length === 0) return errorResp("No users yet!");

  const fields = results.map((r: any, i: number) => {
    const medals = ["🥇", "🥈", "🥉"];
    const prefix = i < 3 ? medals[i] : `**#${i + 1}**`;
    const progress = getLevelProgress(r.xp);
    return {
      name: `${prefix} <@${r.user_id}>`,
      value: `Level ${progress.level} | ${r.xp} XP | ${r.coins} coins`,
      inline: false,
    };
  });

  return embedResp(4, interactionEmbed("Top 10 Leaderboard", 0xf1c40f, fields));
}

// Staff commands
async function handleSetXp(db: D1Database, interaction: DiscordInteraction): Promise<Response> {
  const memberRoles = interaction.member?.roles || [];
  if (!isStaff(memberRoles)) return errorResp("Staff only!");

  const targetId = interaction.data?.options?.find((o: any) => o.name === "user")?.value;
  const amount = interaction.data?.options?.find((o: any) => o.name === "amount")?.value;
  if (!targetId || amount === undefined) return errorResp("Missing arguments!");

  await ensureUser(db, targetId);
  await db.prepare("UPDATE users SET xp = ? WHERE user_id = ?").bind(amount, targetId).run();

  return embedResp(4, interactionEmbed("XP Set", 0x3498db, [
    { name: "Target", value: `<@${targetId}>`, inline: true },
    { name: "New XP", value: `${amount}`, inline: true },
    { name: "Set By", value: `<@${interaction.member?.user?.id}>`, inline: true },
  ]));
}

async function handleAddXp(db: D1Database, interaction: DiscordInteraction): Promise<Response> {
  const memberRoles = interaction.member?.roles || [];
  if (!isStaff(memberRoles)) return errorResp("Staff only!");

  const targetId = interaction.data?.options?.find((o: any) => o.name === "user")?.value;
  const amount = interaction.data?.options?.find((o: any) => o.name === "amount")?.value;
  if (!targetId || amount === undefined) return errorResp("Missing arguments!");

  await ensureUser(db, targetId);
  await db.prepare("UPDATE users SET xp = xp + ? WHERE user_id = ?").bind(amount, targetId).run();
  const updated = await db.prepare("SELECT xp FROM users WHERE user_id = ?").bind(targetId).first<any>();

  return embedResp(4, interactionEmbed("XP Added", 0x2ecc71, [
    { name: "Target", value: `<@${targetId}>`, inline: true },
    { name: "Added", value: `+${amount} XP`, inline: true },
    { name: "New Total", value: `${updated?.xp || 0}`, inline: true },
    { name: "By", value: `<@${interaction.member?.user?.id}>`, inline: true },
  ]));
}

async function handleRemoveXp(db: D1Database, interaction: DiscordInteraction): Promise<Response> {
  const memberRoles = interaction.member?.roles || [];
  if (!isStaff(memberRoles)) return errorResp("Staff only!");

  const targetId = interaction.data?.options?.find((o: any) => o.name === "user")?.value;
  const amount = interaction.data?.options?.find((o: any) => o.name === "amount")?.value;
  if (!targetId || amount === undefined) return errorResp("Missing arguments!");

  await ensureUser(db, targetId);
  await db.prepare("UPDATE users SET xp = MAX(0, xp - ?) WHERE user_id = ?").bind(amount, targetId).run();
  const updated = await db.prepare("SELECT xp FROM users WHERE user_id = ?").bind(targetId).first<any>();

  return embedResp(4, interactionEmbed("XP Removed", 0xe74c3c, [
    { name: "Target", value: `<@${targetId}>`, inline: true },
    { name: "Removed", value: `-${amount} XP`, inline: true },
    { name: "New Total", value: `${updated?.xp || 0}`, inline: true },
    { name: "By", value: `<@${interaction.member?.user?.id}>`, inline: true },
  ]));
}

async function handleSetCoins(db: D1Database, interaction: DiscordInteraction): Promise<Response> {
  const memberRoles = interaction.member?.roles || [];
  if (!isStaff(memberRoles)) return errorResp("Staff only!");

  const targetId = interaction.data?.options?.find((o: any) => o.name === "user")?.value;
  const amount = interaction.data?.options?.find((o: any) => o.name === "amount")?.value;
  if (!targetId || amount === undefined) return errorResp("Missing arguments!");

  await ensureUser(db, targetId);
  await db.prepare("UPDATE users SET coins = ? WHERE user_id = ?").bind(amount, targetId).run();

  return embedResp(4, interactionEmbed("Coins Set", 0xf39c12, [
    { name: "Target", value: `<@${targetId}>`, inline: true },
    { name: "New Coins", value: `${amount}`, inline: true },
    { name: "By", value: `<@${interaction.member?.user?.id}>`, inline: true },
  ]));
}

// ==================== MAIN HANDLER ====================

async function handleInteraction(env: Env, interaction: DiscordInteraction): Promise<Response> {
  // Ping
  if (interaction.type === 1) {
    return jsonResp({ type: 1 });
  }

  // Slash command
  if (interaction.type !== 2) {
    return errorResp("Unknown interaction type");
  }

  const name = interaction.data?.name;

  switch (name) {
    case "balance":
      return handleBalance(env.astralyx_xp, interaction);
    case "daily":
      return handleDaily(env.astralyx_xp, interaction.member?.user?.id || "");
    case "coinflip": {
      const amount = interaction.data?.options?.find((o: any) => o.name === "amount")?.value;
      const side = interaction.data?.options?.find((o: any) => o.name === "side")?.value;
      return handleCoinflip(env.astralyx_xp, interaction.member?.user?.id || "", amount, side);
    }
    case "slots": {
      const amount = interaction.data?.options?.find((o: any) => o.name === "amount")?.value;
      return handleSlots(env.astralyx_xp, interaction.member?.user?.id || "", amount);
    }
    case "leaderboard":
      return handleLeaderboard(env.astralyx_xp);
    case "setxp":
      return handleSetXp(env.astralyx_xp, interaction);
    case "addxp":
      return handleAddXp(env.astralyx_xp, interaction);
    case "removexp":
      return handleRemoveXp(env.astralyx_xp, interaction);
    case "setcoins":
      return handleSetCoins(env.astralyx_xp, interaction);
    default:
      return errorResp("Unknown command.");
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("Astralyx XP Bot is running!", { status: 200 });
    }

    if (request.method === "POST" && url.pathname === "/interactions") {
      const signature = request.headers.get("X-Signature-Ed25519");
      const timestamp = request.headers.get("X-Signature-Timestamp");
      const body = await request.text();

      if (!signature || !timestamp) {
        return new Response("Missing signature headers", { status: 401 });
      }

      const isValid = await verify(env.DISCORD_PUBLIC_KEY, timestamp + body, signature);
      if (!isValid) {
        return new Response("Invalid signature", { status: 401 });
      }

      const interaction = JSON.parse(body) as DiscordInteraction;
      const response = await handleInteraction(env, interaction);

      return new Response(response.body, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
