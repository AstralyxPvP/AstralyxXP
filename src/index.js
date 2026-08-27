import {
  verifyKey,
  InteractionType,
  InteractionResponseType,
} from "discord-interactions";

const OWNER_ID = "1513925512118931551";

const STAFF_ROLES = [
  "1477025238784151554",
  "1477291491003994214",
  "1502815102716608552",
  "1497335106074050620",
  "1483209618485284964",
  "1497316294632931358",
  "1497316250945323070",
  "1497316120452136960",
  "1477025502119334109",
];

const LEVELS = [
  0, 10, 20, 50, 100, 200, 350, 500, 750, 1000, 1500,
  2200, 3000, 4000, 5500, 7500, 10000, 13000, 17000, 22000,
];

const DAILY_BASE = 10;
const DAILY_STREAK_BONUS = 5;

// ---------- helpers ----------

function levelInfo(xp) {
  let level = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i]) level = i;
  }
  const cur = LEVELS[level];
  const next = LEVELS[level + 1] ?? LEVELS[level];
  const progress = next - cur > 0 ? Math.round(((xp - cur) / (next - cur)) * 20) : 20;
  const bar = "█".repeat(Math.max(0, Math.min(progress, 20))) + "░".repeat(Math.max(0, 20 - Math.min(progress, 20)));
  return { level, xp, cur, next, bar };
}

async function getUser(db, userId) {
  const existing = await db.prepare("SELECT * FROM users WHERE user_id = ?").bind(userId).first();
  if (existing) return existing;
  const xp = userId === OWNER_ID ? 10 : 0;
  await db
    .prepare("INSERT INTO users (user_id, xp, daily_streak, last_daily) VALUES (?, ?, 0, 0)")
    .bind(userId, xp)
    .run();
  return { user_id: userId, xp, daily_streak: 0, last_daily: 0 };
}

function isStaff(roles) {
  return (roles || []).some((r) => STAFF_ROLES.includes(r));
}

function reply(data) {
  return { type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data };
}

function success(content) {
  return reply({ content });
}

function fail(content) {
  return reply({ content, flags: 64 });
}

function embed(title, color, fields) {
  return reply({ embeds: [{ title, color, fields, timestamp: new Date().toISOString() }] });
}

// ---------- commands ----------

async function balance(db, interaction) {
  const opt = (interaction.data.options || []).find((o) => o.name === "user");
  const id = (opt && opt.value) || interaction.member.user.id;
  const u = await getUser(db, id);
  const li = levelInfo(u.xp);
  const self = id === interaction.member.user.id;

  return embed(
    self ? "Your Balance" : `Balance for <@${id}>`,
    0x5865f2,
    [
      { name: "Level", value: `${li.level}`, inline: true },
      { name: "XP", value: `${li.xp}`, inline: true },
      { name: "Progress", value: `\`${li.bar}\` ${li.xp - li.cur}/${li.next - li.cur} XP`, inline: false },
    ]
  );
}

async function daily(db, userId) {
  const u = await getUser(db, userId);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  if (now - u.last_daily < day) {
    const next = new Date(u.last_daily + day);
    return fail(`Daily already claimed! Come back <t:${Math.floor(next.getTime() / 1000)}:R>`);
  }

  const streakBroken = now - u.last_daily > 2 * day;
  const streak = streakBroken ? 1 : (u.daily_streak || 0) + 1;
  const bonus = streak >= 3 ? DAILY_STREAK_BONUS * Math.floor(streak / 3) : 0;
  const total = DAILY_BASE + bonus;

  await db
    .prepare("UPDATE users SET xp = xp + ?, daily_streak = ?, last_daily = ? WHERE user_id = ?")
    .bind(total, streak, now, userId)
    .run();

  const fields = [
    { name: "XP Earned", value: `+${total} XP`, inline: true },
    { name: "Total XP", value: `${u.xp + total}`, inline: true },
    { name: "Streak", value: `${streak} day${streak > 1 ? "s" : ""}`, inline: true },
  ];
  if (bonus > 0) fields.push({ name: "Streak Bonus", value: `+${bonus}`, inline: true });

  return embed("Daily Reward Claimed!", 0x2ecc71, fields);
}

async function coinflip(db, userId, amount, side) {
  if (!amount || amount <= 0) return fail("Bet must be a positive number!");
  const u = await getUser(db, userId);
  if (u.xp < amount) return fail(`You only have ${u.xp} XP!`);

  const result = Math.random() < 0.5 ? "heads" : "tails";
  const won = result === side;
  const delta = won ? amount : -amount;

  await db.prepare("UPDATE users SET xp = xp + ? WHERE user_id = ?").bind(delta, userId).run();

  return embed(
    won ? "You Won!" : "You Lost!",
    won ? 0x2ecc71 : 0xe74c3c,
    [
      { name: "Bet", value: `${amount} XP on **${side}**`, inline: true },
      { name: "Result", value: `**${result.toUpperCase()}**`, inline: true },
      { name: "Outcome", value: won ? `+${amount} XP` : `-${amount} XP`, inline: true },
      { name: "Balance", value: `${u.xp + delta} XP`, inline: true },
    ]
  );
}

async function slots(db, userId, amount) {
  if (!amount || amount <= 0) return fail("Bet must be a positive number!");
  const u = await getUser(db, userId);
  if (u.xp < amount) return fail(`You only have ${u.xp} XP!`);

  const symbols = ["🍒", "🍋", "🍊", "🍇", "💎", "7️⃣"];
  const weights = [30, 25, 20, 15, 7, 3];
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const pick = () => {
    let r = Math.random() * totalWeight;
    for (let i = 0; i < symbols.length; i++) {
      r -= weights[i];
      if (r <= 0) return symbols[i];
    }
    return symbols[0];
  };

  const s1 = pick(), s2 = pick(), s3 = pick();
  let mult = 0;
  if (s1 === s2 && s2 === s3) mult = s1 === "7️⃣" ? 10 : s1 === "💎" ? 7 : 5;
  else if (s1 === s2 || s2 === s3 || s1 === s3) mult = 2;

  const win = amount * mult;
  const net = win - amount;

  await db.prepare("UPDATE users SET xp = xp + ? WHERE user_id = ?").bind(net, userId).run();

  return embed(
    mult > 0 ? "Slot Win!" : "Slot Lose!",
    mult > 0 ? 0x2ecc71 : 0xe74c3c,
    [
      { name: "Slots", value: `\`\`\`[ ${s1} | ${s2} | ${s3} ]\`\`\``, inline: false },
      { name: "Bet", value: `${amount} XP`, inline: true },
      { name: "Multiplier", value: `${mult}x`, inline: true },
      { name: "Net", value: `${net >= 0 ? "+" : ""}${net} XP`, inline: true },
      { name: "Balance", value: `${u.xp + net} XP`, inline: true },
    ]
  );
}

async function leaderboard(db) {
  const rows = await db.prepare("SELECT user_id, xp FROM users ORDER BY xp DESC LIMIT 10").all();
  const results = rows.results || [];
  if (!results.length) return fail("No users yet!");

  const medals = ["🥇", "🥈", "🥉"];
  const fields = results.map((r, i) => {
    const li = levelInfo(r.xp);
    return {
      name: `${i < 3 ? medals[i] : `**#${i + 1}**`} <@${r.user_id}>`,
      value: `Level ${li.level} | ${r.xp} XP`,
      inline: false,
    };
  });

  return embed("Top 10 Leaderboard", 0xf1c40f, fields);
}

// ---------- staff commands ----------

async function staffGuard(interaction) {
  if (!isStaff(interaction.member?.roles)) return fail("You do not have permission to use this command.");
  const opts = {};
  for (const o of interaction.data.options || []) opts[o.name] = o.value;
  if (!opts.user || opts.amount === undefined) return fail("Missing arguments!");
  return opts;
}

async function setxp(db, interaction) {
  const opts = await staffGuard(interaction);
  if (!opts.amount) return opts;
  await getUser(db, opts.user);
  await db.prepare("UPDATE users SET xp = ? WHERE user_id = ?").bind(opts.amount, opts.user).run();
  return embed("XP Set", 0x3498db, [
    { name: "Target", value: `<@${opts.user}>`, inline: true },
    { name: "New XP", value: `${opts.amount}`, inline: true },
    { name: "By", value: `<@${interaction.member.user.id}>`, inline: true },
  ]);
}

async function addxp(db, interaction) {
  const opts = await staffGuard(interaction);
  if (!opts.amount) return opts;
  await getUser(db, opts.user);
  await db.prepare("UPDATE users SET xp = xp + ? WHERE user_id = ?").bind(opts.amount, opts.user).run();
  const r = await db.prepare("SELECT xp FROM users WHERE user_id = ?").bind(opts.user).first();
  return embed("XP Added", 0x2ecc71, [
    { name: "Target", value: `<@${opts.user}>`, inline: true },
    { name: "Added", value: `+${opts.amount} XP`, inline: true },
    { name: "New Total", value: `${r.xp}`, inline: true },
    { name: "By", value: `<@${interaction.member.user.id}>`, inline: true },
  ]);
}

async function removexp(db, interaction) {
  const opts = await staffGuard(interaction);
  if (!opts.amount) return opts;
  await getUser(db, opts.user);
  await db.prepare("UPDATE users SET xp = MAX(0, xp - ?) WHERE user_id = ?").bind(opts.amount, opts.user).run();
  const r = await db.prepare("SELECT xp FROM users WHERE user_id = ?").bind(opts.user).first();
  return embed("XP Removed", 0xe74c3c, [
    { name: "Target", value: `<@${opts.user}>`, inline: true },
    { name: "Removed", value: `-${opts.amount} XP`, inline: true },
    { name: "New Total", value: `${r.xp}`, inline: true },
    { name: "By", value: `<@${interaction.member.user.id}>`, inline: true },
  ]);
}

// ---------- router ----------

async function handle(env, interaction) {
  const t = interaction.type;
  const udata = interaction.data || {};

  switch (t) {
    case InteractionType.PING:
      return { type: InteractionResponseType.PONG };

    case InteractionType.APPLICATION_COMMAND: {
      const uid = interaction.member.user.id;
      const opts = {};
      for (const o of udata.options || []) opts[o.name] = o.value;

      switch (udata.name) {
        case "balance": return balance(env.astralyx_xp, interaction, opts);
        case "daily": return daily(env.astralyx_xp, uid, opts);
        case "coinflip": return coinflip(env.astralyx_xp, uid, opts.amount, opts.side);
        case "slots": return slots(env.astralyx_xp, uid, opts.amount);
        case "leaderboard": return leaderboard(env.astralyx_xp);
        case "setxp": return setxp(env.astralyx_xp, interaction);
        case "addxp": return addxp(env.astralyx_xp, interaction);
        case "removexp": return removexp(env.astralyx_xp, interaction);
        default: return fail("Unknown command.");
      }
    }

    default:
      return fail("Unknown interaction type.");
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET") {
      return new Response("Astralyx XP Bot is running!", { status: 200 });
    }

    if (request.method === "POST" && url.pathname === "/interactions") {
      const signature = request.headers.get("X-Signature-Ed25519");
      const timestamp = request.headers.get("X-Signature-Timestamp");
      const body = await request.text();

      if (!signature || !timestamp) {
        return new Response("Missing signature headers", { status: 401 });
      }

      const valid = verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
      if (!valid) {
        return new Response("Invalid request signature", { status: 401 });
      }

      const interaction = JSON.parse(body);
      const response = await handle(env, interaction);

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};