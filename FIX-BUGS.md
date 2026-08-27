# AstralyxXP — Bug Fixes & Weak Points

Fixes for the deployed AstralyxXP bot. Do NOT touch the D1 schema — the live `users` table was already rebuilt to match `schema.sql` (`discord_id`, `xp`, `daily_last_claimed`, `daily_streak`).

---

## Bug 1: `/balance` shows broken numbers (LIVE-CONFIRMED)

User output: `XP: 99 / 0`, `NaN%`, `Need -99 more XP`. Root cause: **`src/commands/balance.js`** misuses the level helpers.

```js
const nextLevelXP = level < MAX_LEVEL ? XP_THRESHOLDS[level] : currentXP; // BUG: [level], not [level+1]
const { progressPercent } = getProgress(currentXP);                        // BUG: field doesn't exist (it's `progress`, 0..1)
const bar = progressBar(progressPercent);                                   // BUG: progressBar(undefined)
... `${bar} ${Math.floor(progressPercent * 100)}%\n*Need ${nextLevelXP - currentXP}*` // BUG
```

`getProgress(xp)` returns `{ level, xp, currentThreshold, nextThreshold, xpIntoLevel, xpNeeded, progress }`. `progressBar(current, max)`.

Fix:
```js
const { level, nextThreshold, xpIntoLevel, xpNeeded, progress } = getProgress(currentXP);
const bar = progressBar(xpIntoLevel, xpNeeded);
let description = `**Level:** ${level}\n**XP:** ${currentXP}`;
if (nextThreshold === null) {
  description += `\n\n${bar} 100%\n*Max level reached!*`;
} else {
  description += ` / ${nextThreshold}\n\n${bar} ${Math.floor(progress * 100)}%\n*Need ${xpNeeded - xpIntoLevel} more XP to level up!*`;
}
```

## Bug 2: `checkLevelUp()` called with WRONG arguments everywhere

Signature: `checkLevelUp(oldXP, newXP)` — two **numbers**. Every caller passes `(env.astralyx_xp, userId, oldXp, newXp)` → leveling computed on garbage → **level-up messages never fire**.

Fix every call to pass numbers only:

| File | Line | Call |
|------|------|------|
| `src/commands/setxp.js` | 23 | `checkLevelUp(oldXp, amount)` |
| `src/commands/addxp.js` | 23 | `checkLevelUp(oldXp, newXp)` |
| `src/commands/removexp.js` | 23 | `checkLevelUp(oldXp, newXp)` |
| `src/commands/coinflip.js` | 48 | `checkLevelUp(user.xp, newXp)` |
| `src/commands/slots.js` | 54 | `checkLevelUp(user.xp, newXp)` |
| `src/commands/daily.js` | 41 | `checkLevelUp(user.xp, user.xp + reward)` |
| `src/games/fallen-xp.js` | 68 | capture XP before & after, then `checkLevelUp(prev, prev + reward)` |
| `src/games/guess.js` | 134 | same (capture before `addXP`) |
| `src/games/ladders.js` | 101 | same |
| `src/games/raining-xp.js` | 121 | same |
| `src/games/luck-duck.js` | — | unused import → remove |

Callers also test the result as `levelUp.leveledUp`. The function returns `null` or `{ oldLevel, newLevel }` — pick one shape and use it consistently.

## Bug 3: `ephemeralResponse()` called with an OBJECT, not a string

`src/utils/discord.js`:
```js
export function ephemeralResponse(content) {
  return jsonResponse({ type: 4, data: { content, flags: 64 } }); // content must be a string
}
```
Most callers do `ephemeralResponse({ content: "..." })` → `data.content` becomes an object → **Discord rejects the response (400)** and the real message never shows. Files: `setxp.js:9`, `addxp.js:9`, `removexp.js:9`, `minigame.js:9`, `coinflip.js:14/17`, `slots.js:14`, `transfer.js:12/15`.

Fix: pass a plain string — `ephemeralResponse("You do not have permission to use this command.")`.

## Bug 4: `/daily` writes a timestamp into `daily_streak`

`src/utils/db.js` `updateDaily(db, discordId, streak)` binds `streak` into the column. But `src/commands/daily.js:38` calls:
```js
await updateDaily(env.astralyx_xp, userId, now, streak); // 4 args — `streak` param receives `now`!
```
→ `daily_streak` is set to `Date.now()` (a huge number), not the streak count. Fix: `updateDaily(env.astralyx_xp, userId, streak)`.

## Bug 5: `/minigame` never works (broken SQL insert)

`src/commands/minigame.js:18-21` does:
```js
INSERT INTO minigame_sessions (id, game_type, xp_reward, created_at) VALUES (?, ?, ?, ?)
```
But `minigame_sessions.channel_id` and `expires_at` are `NOT NULL` → **insert always throws** → caught → replies "Failed to start minigame." It also creates its own `sessionId` and passes it to `createGame`, but the game modules generate their own session IDs and post their own message.

Fix: delete the redundant INSERT entirely — just pick a game and call `createGame(interaction, env, ctx, xpReward)`;

---

## Weak points found (worth fixing while you're in there)

1. **No error handling in deferred command bodies.** Every command wraps its work in `ctx.waitUntil(() => {...})` with no `try/catch`. If D1 throws mid-way, `waitUntil` rejects silently, Discord stays on "AstralyxXP is thinking..." forever, and no follow-up is ever sent. (This is exactly what the live schema bug did.) Add `try { ... } catch (e) { console.error(e); await patchOriginal(..., { content: "Something went wrong." }); }` in every command and game reward path.

2. **Games only end when someone clicks *after* expiry.** In `raining-xp.js`/`guess.js`, `endAndReward` fires only when a click arrives with `Date.now() > expires_at`. If nobody clicks after the timer, the buttons stay live, no payout, no cleanup — and `minigame_sessions` rows pile up forever (schema comment says "cleaned up after game ends" but nothing deletes them). Add a real expiration path (e.g. guard on expiry at click time + DELETE/UPDATE on end), and delete the session row when a game concludes.

3. **`luck-duck.js` may never pay out.** The "winner" just gets an ephemeral "you will receive your XP when the game ends in 10s" and `expires_at` is bumped +10s — but nothing actually settles it after 10s; "partial XP" for later finders is also never granted. Wire the end-of-game payout (first finder full, later finders −20%).

4. **Level-up messages are only checked in minigame payouts, not `/transfer` or staff commands.** Bugs 2 fixed that, but also note `checkLevelUp` in games currently isn't even called with usable pre/post values, so reward paths should capture XP *before* `addXP`.

5. **`balance.js:31-32` footer bug.** `embed.footer = { text: \`Linked Account: ${linkedAccount}\` }` stringifies the whole row object (`[object Object]`). Use `linkedAccount.minecraft_name`.

6. **REST API can't authenticate — `API_SECRET` is not set as a worker secret.** Live secrets are only `DISCORD_TOKEN`, `DISCORD_PUBLIC_KEY`, `DISCORD_APPLICATION_ID`. `/api/*` currently returns 401 for everything. Someone must run `wrangler secret put API_SECRET` (repo `CLOUDFLARE_API_TOKEN` exists for CI). Add it to the deploy flow or set it manually.

7. **`/api/link` has no verification** — any caller with the API secret can link arbitrary Discord↔Minecraft pairs. Fine for now (secret-gated), but note for when it's exposed to players.

8. **`/coinflip`/`/slots`/`/transfer` guard amount server-side, but not min/max clamp for `/transfer`** (no `max_value`). A user could transfer huge sums. Optional.

## Notes

- Deployment is automatic on push to `main` (GitHub Actions → `wrangler deploy`).
- **Do not re-register slash commands** — live (application `1542222656148078643`).
- **Do not touch the D1 `users` table.**
- Plain JavaScript only — no TypeScript.
- Verify after fixing: `/setxp @user 99` → `/balance` shows `XP: 99 / 100`, a small bar, `Need 1 more XP`. Then `/daily` twice (24h apart logic aside, check DB: `daily_streak` should be 1, not a timestamp).