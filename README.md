[![GitHub license](https://img.shields.io/github/license/AstralyxPvP/AstralyxXP?color=blue&logo=gnu)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Deployed%20on-Cloudflare%20Workers-orange?logo=cloudflare)](https://astralyx-xp-bot.indiancoder3.workers.dev)
[![Discord](https://img.shields.io/discord/1477025023800901766?logo=discord&logoColor=white&color=7389D8&label=discord)](https://discord.gg/u8BFrpRwEg)
[![D1](https://img.shields.io/badge/Database-D1%20SQLite-blue?logo=sqlite)](https://developers.cloudflare.com/d1/)
[![Status](https://img.shields.io/website?url=https%3A%2F%2Fastralyx-xp-bot.indiancoder3.workers.dev%2F&up_message=online&down_message=offline&logo=cloudflare)](https://astralyx-xp-bot.indiancoder3.workers.dev)

# AstralyxXP

![AstralyxPvP Logo](https://astralyxpvp.pages.dev/Assets/logo.png)

**The official XP & Levels bot for AstralyxPvP** — earn XP through daily rewards, community engagement, and interactive minigames. Climb the levels, unlock ranks and in-game cosmetics, and prove your grind.

Built on **Cloudflare Workers** with a **D1** database. Fully compatible with the [AstralyxPvP Minecraft server](https://astralyxpvp.pages.dev) and the in-game plugin via account linking.

## ⚔️ How It Works

Everything runs on **XP** — no coins, no pay-to-win. Every player starts at **0 XP**, staff included.

- **Grind it** — claim `/daily`, win minigames, and stay active in the community.
- **Level up** — XP unlocks levels automatically, and levels unlock ranks & cosmetics.
- **Risk it** — bet your XP on `/coinflip` and `/slots`.
- **Prove it** — top players land on the `/leaderboard`.

## 🎮 Features

- **Level system** — 0 → 15 with rising XP thresholds (extendable to 50).
- **Daily rewards** — XP every 24h with streak bonuses that grow over time.
- **Minigames** — the bot launches random XP events when chat activity spikes (10+ messages/minute):
  - Raining XP
  - Guess the answer
  - Fallen XP
  - Ladders
  - Luck Duck
- **Community commands** — `/balance`, `/leaderboard`, `/transfer`.
- **Staff tools** — grant or strip XP directly.
- **In-game integration** — account linking unlocks in-game gems and roles.

## 📜 Commands

### Everyone

| Command | Description |
|---------|-------------|
| `/balance [@user]` | Your XP, level & progress — or another user's. |
| `/daily` | Claim XP once per 24h. Streaks boost rewards. |
| `/coinflip <amount> <heads\|tails>` | Bet XP on a coin flip. |
| `/slots <amount>` | Bet XP on the slot machine. |
| `/leaderboard [count]` | Top players by XP. |
| `/transfer <user> <amount>` | Send XP to another player. |

### Staff only

| Command | Description |
|---------|-------------|
| `/setxp <user> <amount>` | Set a user's XP exactly. |
| `/addxp <user> <amount>` | Add XP to a user. |
| `/removexp <user> <amount>` | Remove XP (can't go below 0). |

> Staff = Owner, Co-Owner, Chief Manager, Sr. Manager, Manager, Developer, Admin, Sr. Mod, Mod.

## 🛠️ Tech Stack

- **Runtime:** Cloudflare Workers (edge serverless)
- **Database:** Cloudflare D1 (SQLite)
- **Discord:** Interactions API (slash commands & components)
- **Deployment:** GitHub Actions → `wrangler deploy` on every push to `main`

## 🚀 Development

```bash
npm install
npx wrangler dev
```

Local bindings use `--local` storage by default; secrets go in `.dev.vars`.

## 🌐 Links

- **Discord:** [discord.gg/u8BFrpRwEg](https://discord.gg/u8BFrpRwEg)
- **Website:** [astralyxpvp.pages.dev](https://astralyxpvp.pages.dev)
- **Server IP:** `java.astralyxpvp.int.yt`
- **Site Repo:** [AstralyxPvP/AstralyxPvP-site](https://github.com/AstralyxPvP/AstralyxPvP-site)

## 📄 License

This project is licensed under the **GNU GPL v3 License**. See the [LICENSE](./LICENSE) file for details.

---

© NebulaGames 2026. Not affiliated with Mojang.