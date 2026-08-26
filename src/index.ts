import { verify } from "./crypto";

const OWNER_ID = "1513925512118931551";
const OWNER_STARTING_XP = 10;

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
];

function getLevelForXp(xp: number): number {
  let level = 0;
  for (const l of LEVELS) {
    if (xp >= l.xp) level = l.level;
  }
  return level;
}

function getLevelProgress(xp: number): { level: number; current: number; next: number } {
  const level = getLevelForXp(xp);
  const currentReq = LEVELS.find((l) => l.level === level)?.xp ?? 0;
  const nextReq = LEVELS.find((l) => l.level === level + 1)?.xp ?? currentReq;
  return { level, current: xp - currentReq, next: nextReq - currentReq };
}

async function ensureUser(db: D1Database, userId: string): Promise<{ xp: number }> {
  const existing = await db
    .prepare("SELECT xp FROM users WHERE user_id = ?")
    .bind(userId)
    .first<{ xp: number }>();

  if (existing) return existing;

  const startingXp = userId === OWNER_ID ? OWNER_STARTING_XP : 0;
  await db
    .prepare("INSERT INTO users (user_id, xp) VALUES (?, ?)")
    .bind(userId, startingXp)
    .run();

  return { xp: startingXp };
}

async function handleBalance(
  env: Env,
  userId: string,
  options: { user?: string } = {}
): Promise<Response> {
  const targetId = options.user || userId;

  const user = await ensureUser(env.astralyx_xp, targetId);
  const progress = getLevelProgress(user.xp);

  const barLength = 20;
  const filled = Math.round((progress.current / progress.next) * barLength) || 0;
  const empty = barLength - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);

  const isSelf = targetId === userId;
  const title = isSelf ? "Your Balance" : `Balance for <@${targetId}>`;

  return {
    content: JSON.stringify({
      embeds: [
        {
          title,
          color: 0x5865f2,
          fields: [
            { name: "Level", value: `${progress.level}`, inline: true },
            { name: "XP", value: `${user.xp}`, inline: true },
            { name: "Progress", value: `\`${bar}\` ${progress.current}/${progress.next} XP` },
          ],
          footer: { text: "Astralyx XP" },
        },
      ],
    }),
    status: 200,
  };
}

async function handleInteraction(
  env: Env,
  interaction: DiscordInteraction
): Promise<Response> {
  if (interaction.type === 1) {
    return { content: JSON.stringify({ type: 1 }), status: 200 };
  }

  if (interaction.type === 2 && interaction.data?.name === "balance") {
    const targetOption = interaction.data.options?.find(
      (o: any) => o.name === "user"
    );
    const targetId = targetOption?.value || interaction.member?.user?.id;

    const user = await ensureUser(env.astralyx_xp, targetId);
    const progress = getLevelProgress(user.xp);

    const barLength = 20;
    const filled = Math.round((progress.current / progress.next) * barLength) || 0;
    const empty = barLength - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);

    const isSelf = targetId === interaction.member?.user?.id;
    const title = isSelf ? "Your Balance" : `Balance for <@${targetId}>`;

    return {
      content: JSON.stringify({
        type: 4,
        data: {
          embeds: [
            {
              title,
              color: 0x5865f2,
              fields: [
                { name: "Level", value: `${progress.level}`, inline: true },
                { name: "XP", value: `${user.xp}`, inline: true },
                {
                  name: "Progress",
                  value: `\`${bar}\` ${progress.current}/${progress.next} XP`,
                },
              ],
              footer: { text: "Astralyx XP" },
            },
          ],
        },
      }),
      status: 200,
    };
  }

  return {
    content: JSON.stringify({
      type: 4,
      data: { content: "Unknown command." },
    }),
    status: 200,
  };
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

      const isValid = await verify(
        env.DISCORD_PUBLIC_KEY,
        timestamp + body,
        signature
      );
      if (!isValid) {
        return new Response("Invalid signature", { status: 401 });
      }

      const interaction = JSON.parse(body) as DiscordInteraction;
      const response = await handleInteraction(env, interaction);

      return new Response(response.content, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
