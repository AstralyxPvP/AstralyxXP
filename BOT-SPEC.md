# AstralyxXP — Discord Bot & Paper Plugin

A Discord XP bot for the AstralyxPvP Minecraft server. Runs on Cloudflare Workers with a D1 database. It should be also compatible, as we will also integrate it with the Minecraft Server, so well, see /home/abhinu/Desktop/SSD/HDD/AstralyxPvP/AstralyxAI-server-bot, so this has account linking, and via account linking you can unlock the in-game gems. Roles will be both in Discord and In-Game (in-game only if the user linked their account...). So, for minigames, when the bot sees like above 10 messages per minute, it does a random minigame.

## Goal

Players earn XP through daily rewards, community engagement, and minigames. XP unlocks levels. Staff can manage XP directly. No coins — XP is the only currency.

With Levels and XP, you can unlock things, such as ranks, in-game cosmetics, and more!

XP cannot be bought using real money. It is about grinding and fairness.

## MiniGames
Minigames give max-to-max 50 XP (can be random).
These are some ideas for minigames:
- Raining XP - Click the Button to collect, the first one to click earns the most, others who participated get 40% less.
- Guess the answer - Random questions with options, first one to answer correctly gets the XP, others get 10% less.
- Fallen XP - First one to click gets the XP, others get nothing but some good luck message.
- Ladders (the snake ladder type but small) - Many people can participate, first one to complete it wins.
- Luck Duck - From the buttons, guess which one is hiding the duck. First one to win gets the desired XP decided by the bot. Others get 20% less.

## Starting XP

- Everyone else starts at 0 XP.
- No exception for premium rank holders or staff, they too start off 0.

## Levels

XP thresholds for each level (You may edit this, and somehow take this to like level 50 or something, and make level 1 as like 100 or something):

| Level | XP needed |
|-------|-----------|
| 0  | 0 |
| 1  | 10 |
| 2  | 20 |
| 3  | 50 |
| 4  | 100 |
| 5  | 200 |
| 6  | 350 |
| 7  | 500 |
| 8  | 750 |
| 9  | 1000 |
| 10 | 1500 |
| 11 | 2200 |
| 12 | 3000 |
| 13 | 4000 |
| 14 | 5500 |
| 15 | 7500 |

Leveling up is automatic based on total XP.

## Commands (everyone)

- `/balance` — Shows your XP, level, and progress toward next level.
  - Optional: `/balance @user` shows another user's stats.
- `/daily` — Claim daily XP once per 24h. Streaks increase the reward:
  - Day 1–2: 10 XP
  - Every 3 days: +5 bonus XP per streak tier.
- `/coinflip <amount> <heads|tails>` — Bet XP on a coin flip. Win = double your bet. Lose = lose the bet.
- `/slots <amount>` — Bet XP on the slot machine. 3 matching symbols win big, 2 matching win 2x.
- `/leaderboard` — Top 10 players by XP.
  - Optional: An argument specifying the number of people on the leaderboard.
- `/transfer` - Transfer your XP to someone else.

## Commands (staff only)

- `/setxp <user> <amount>` — Set a user's XP to exactly this amount.
- `/addxp <user> <amount>` — Add XP to a user.
- `/removexp <user> <amount>` — Remove XP from a user (can't go below 0).

## Staff roles

Staff are detected by these Discord roles (in order of rank) (there's more staff below Moderator, but we ain't providing them privilege):

1. Owner (`1477025238784151554`)
2. Co-Owner (`1477291491003994214`)
3. Chief Manager (`1502815102716608552`)
4. Sr. Manager (`1497335106074050620`)
5. Manager (`1483209618485284964`)
6. Developer (`1497316294632931358`)
7. Admin (`1497316250945323070`)
8. Sr. Mod (`1497316120452136960`)
9. Mod (`1477025502119334109`)

## Cloudflare infrastructure

- **Worker name:** `astralyx-xp-bot`
- **Worker URL:** `https://astralyx-xp-bot.indiancoder3.workers.dev`
- **Interaction endpoint:** `/interactions` on the worker URL
- **D1 database name:** `astralyx-xp`
- **D1 database id:** `8d49959b-aa51-4e7e-a5ac-8829b6709cf1`
- **D1 binding name:** `astralyx_xp`
- **Deployment:** repo auto-deploys on push to `main` via GitHub Actions (needs the `CLOUDFLARE_API_TOKEN` repo secret).

## Discord application

- **Application ID:** `1542222656148078643`
- **Public Key:** `bfa5593606761d59d3d8f725d60752c48d22cc22070fdaa26d3d0b8a53511e10`

Worker secrets that are already set on Cloudflare: `DISCORD_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_APPLICATION_ID`.

The site lives at `../AstralyxPvP-site`.