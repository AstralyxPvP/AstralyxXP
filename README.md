![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)
![D1](https://img.shields.io/badge/Database-D1_SQLite-F6822E?style=for-the-badge&logo=sqlite&logoColor=white)
![Paper](https://img.shields.io/badge/Plugin-Paper_1.21-e34c26?style=for-the-badge)
![Discord](https://img.shields.io/badge/Discord-Bot-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Minecraft](https://img.shields.io/badge/Minecraft-Java_1.9+-00aa00?style=for-the-badge)
![Made in India](https://img.shields.io/badge/Made_in-India_🇮🇳-FF9933?style=for-the-badge)

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

- **Level system** — 50 levels (level 1 = 100 XP) with rising XP thresholds.
- **Daily rewards** — XP every 24h with streak bonuses that grow over time.
- **Minigames** — the bot launches random XP events when chat activity spikes (10+ messages/minute):
  - Raining XP
  - Guess the answer
  - Fallen XP
  - Ladders
  - Luck Duck
- **Community commands** — `/balance`, `/leaderboard`, `/transfer`.
- **Staff tools** — grant or strip XP directly.
- **In-game plugin** — a Paper plugin (`AstralyxXP.jar`) for linked & unlinked players:
  - `/xp`, `/balance`, `/daily` — view & claim from in-game.
  - `/coinflip`, `/slots`, `/transfer` — gamble and trade XP on the server.
  - `/xp link` + `/linkaccount` — connect Discord (XP syncs everywhere).
  - `/xp bind <discordId>` — manual XP-account link, no code (overrides `/linkaccount`).
  - `/xp unlinked` — grind Minecraft-only XP that never syncs to Discord.
  - **Smart merge** — if a player grinds unlinked then links later, the higher of their Minecraft or Discord XP wins.

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
- **Platform:** Paper 1.21 plugin for in-game XP commands
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