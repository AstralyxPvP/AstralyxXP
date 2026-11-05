![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)
![D1](https://img.shields.io/badge/Database-D1_SQLite-F6822E?style=for-the-badge&logo=sqlite&logoColor=white)
![Paper](https://img.shields.io/badge/Plugin-Paper_1.21-e34c26?style=for-the-badge)
![Discord](https://img.shields.io/badge/Discord-Bot-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![Minecraft](https://img.shields.io/badge/Minecraft-Java_1.9+-00aa00?style=for-the-badge)
![Made in India](https://img.shields.io/badge/Made_in-India_🇮🇳-FF9933?style=for-the-badge)

# AstralyxXP

![AstralyxPvP Logo](https://www.astralyxpvp.int.yt/Assets/logo.png)

**The official XP & Levels bot for AstralyxPvP** — earn XP through daily rewards, community engagement, and interactive minigames. Climb the levels, unlock ranks and in-game cosmetics, and prove your grind.

Built on **Cloudflare Workers** with a **D1** database. Fully compatible with the [AstralyxPvP Minecraft server](https://www.astralyxpvp.int.yt) and the in-game plugin via account linking.

Part of the **[AstralyxPvP](https://github.com/AstralyxPvP) organization** — see the [site repo](https://github.com/AstralyxPvP/AstralyxPvP-site) for the web frontend.

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
- **In-game plugin** — a Paper plugin (`AstralyxXP.jar`) for linked & unlinked players:
  - `/xp`, `/balance`, `/daily` — view & claim from in-game.
  - `/coinflip`, `/slots`, `/transfer` — gamble and trade XP on the server.
  - `/xp link` + `/linkaccount` — connect Discord (XP syncs everywhere).
  - `/xp bind <discordId>` — manual XP-account link, no code (overrides `/linkaccount`).
  - `/xp unlinked` — grind Minecraft-only XP that never syncs to Discord.
  - **Smart merge** — if a player grinds unlinked then links later, the higher of their Minecraft or Discord XP wins.
- **Website XP leaderboard** — the public, read-only `GET /api/leaderboard` endpoint powers XP rankings on the website; all other API routes remain authenticated.

## 📜 Discord Commands

### Everyone

| Command | Description |
|---------|-------------|
| `/balance [@user]` | Your XP, level & progress — or another user's. |
| `/daily` | Claim XP once per 24h. Streaks boost rewards. |
| `/coinflip <amount> <heads\|tails>` | Bet XP on a coin flip. |
| `/slots <amount>` | Bet XP on the slot machine. |
| `/leaderboard [count]` | Top players by XP. |
| `/transfer <user> <amount>` | Send XP to another player. |
| `/minigame` | Kick off an XP minigame. |

### Staff only

| Command | Description |
|---------|-------------|
| `/setxp <user> <amount>` | Set a user's XP exactly. |
| `/addxp <user> <amount>` | Add XP to a user. |
| `/removexp <user> <amount>` | Remove XP (can't go below 0). |

> Staff = Owner, Co-Owner, Chief Manager, Sr. Manager, Manager, Sr. Developer, Developer, Jr. Developer, Admin, Sr. Mod, Mod, Jr. Mod, Helper, Trial.

## ⛏️ In-Game Commands (Paper plugin)

### Everyone

| Command | Description |
|---------|-------------|
| `/xp` | View your XP & level. |
| `/xp link` | Start the Discord link flow. |
| `/xp bind <discordId>` | Manually link your XP account (overrides `/linkaccount`). |
| `/xp unlinked` | Choose Minecraft-only XP (no `/link` later). |
| `/xp claim` | Claim your daily XP reward in-game. |
| `/balance` (`/bal`) | View your XP balance. |
| `/daily` | Claim your daily XP reward. |
| `/coinflip <heads\|tails> <amount>` (`/cf`, `/flip`) | Bet XP on a coin flip. |
| `/slots <amount>` (`/slot`, `/casino`) | Play the one-armed bandit. |
| `/transfer <player> <amount>` (`/pay`, `/give`) | Send XP to another online player. |
| `/leaderboard [limit]` (`/lb`, `/top`) | Top Astralyx XP earners. |

### Skript and XP-bar integration

The Paper plugin mirrors the Astralyx account level and within-level XP progress
to Minecraft's level number and XP bar. It suppresses vanilla XP orb gains so
the displayed bar remains an Astralyx XP display. Linked accounts sync from the
XP service; the existing Minecraft-only `/xp unlinked` mode is also supported.

With PlaceholderAPI installed, Skript can read these online-player placeholders
using either the `%astralyx_*%` identifiers or the legacy `%astralyxxp_*%`
identifiers:

* `%astralyx_xp%` — total Astralyx XP
* `%astralyx_level%` — Astralyx level
* `%astralyx_progress%` — percent of progress toward the next level
* `%astralyx_xp_into_level%` — XP earned within the current level
* `%astralyx_xp_to_next_level%` — XP remaining to the next level
* `%astralyx_kills%` — Minecraft PvP kills recorded for the linked account

For Skript placeholder expressions, install a Skript addon that supports
PlaceholderAPI placeholders (for example, Skript-Placeholders). The plugin
refreshes its online-player XP and kill-stat cache every 30 seconds;
placeholders are cached values and return empty until the first successful
account sync. Kill counts come from the AstralyxXP worker's Minecraft reward
records, so the D1 schema must be applied and the Paper plugin must be able to
reach the worker.

Skript can grant XP through the permission-protected command:

```skript
command /rewardxp <player> <number>:
    permission: astralyxxp.admin
    trigger:
        execute console command "astralyxxp givexp %arg-1% %arg-2%"
```

`/astralyxxp xp <online-player>` prints the current numeric account balance to
the sender. `/astralyxxp givexp <online-player> <amount>` grants 1–5000 XP.
Both commands require `astralyxxp.admin` (default: operators); linked rewards
are recorded by the authenticated AstralyxXP worker API, while `/xp unlinked`
players receive Minecraft-only account XP.

## 🛠️ Tech Stack

- **Runtime:** Cloudflare Workers (edge serverless)
- **Database:** Cloudflare D1 (SQLite)
- **Discord:** Interactions API (slash commands & components)
- **Platform:** Paper 1.21 plugin for in-game XP commands
- **Deployment:** GitHub Actions → `wrangler deploy` on every push to `main`
- **Build tooling:** [GNU Make](https://www.gnu.org/software/make/) — one command for everything

## 🚀 Development

### Setup

```bash
git clone https://github.com/AstralyxPvP/AstralyxXP.git
cd AstralyxXP
make setup        # npm install
cp .env.example .dev.vars   # then fill in your secrets (NEVER commit this)
```

### Quick reference

```bash
make dev          # run locally at http://localhost:8787 (local D1)
make preview      # run locally against the remote D1
make deploy       # manual deploy to Cloudflare
make dry-run      # validate the worker without deploying
make test         # syntax-check every src file + run unit tests
make check        # node --check on all src/**/*.js
make register     # register Discord slash commands (needs .dev.vars)
make schema       # apply schema.sql to the PRODUCTION D1
make schema-local # apply schema.sql to the LOCAL D1
make plugin       # build the Paper plugin (paper-plugin/target)
make plugin-install # build + copy jar into ../plugins/
make logs         # tail live worker logs
```

Every shortcut is also an npm script (`npm run dev`, `npm run test`, `npm run schema`, …) — pick your flavor.

Run `make help` to list all targets.

Local bindings use `--local` storage by default; secrets go in `.dev.vars`.

## 🌐 Links

- **Discord:** [discord.gg/u8BFrpRwEg](https://discord.gg/u8BFrpRwEg)
- **Website:** [www.astralyxpvp.int.yt](https://www.astralyxpvp.int.yt)
- **Server IP:** `java.astralyxpvp.int.yt`
- **Organization:** [AstralyxPvP](https://github.com/AstralyxPvP)
- **Site Repo:** [AstralyxPvP/AstralyxPvP-site](https://github.com/AstralyxPvP/AstralyxPvP-site)

## 📄 License

This project is licensed under the **GNU GPL v3 License**. See the [LICENSE](./LICENSE) file for details.

---

© NebulaGames 2026. Not affiliated with Mojang.