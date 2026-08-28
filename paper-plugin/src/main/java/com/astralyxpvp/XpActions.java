package com.astralyxpvp;

import java.security.SecureRandom;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.entity.Player;

/**
 * Shared logic for the XP commands. Every command works for BOTH linked
 * players (XP synced through the worker / D1) and unlinked players (in-game
 * Minecraft-only XP that never touches Discord). Pending players are prompted
 * to choose a side first.
 */
public final class XpActions {

    private static final String[] SLOT_SYMBOLS = {"🍒", "🍋", "🔔", "💎", "⭐", "7️⃣"};
    private static final SecureRandom RNG = new SecureRandom();
    private static final long DAY_MS = 24L * 60 * 60 * 1000;

    private final AstralyxXP plugin;
    private final LinkResolver links;
    private final ApiClient xpApi;
    private final LinkState state;

    public XpActions(AstralyxXP plugin, LinkResolver links, ApiClient xpApi, LinkState state) {
        this.plugin = plugin;
        this.links = links;
        this.xpApi = xpApi;
        this.state = state;
    }

    /**
     * Resolves the player's mode and their linked Discord ID (when linked).
     *
     * Manual links (/xp bind, stored in the XP worker's D1 linked_accounts)
     * are checked FIRST and take precedence over /linkaccount links (stored in
     * the private link worker's KV) if the two ever conflict.
     */
    public CompletableFuture<PlayerAccount> resolve(Player p) {
        return xpApi.get("/api/linked/" + p.getUniqueId()).thenCompose(manualBody -> {
            String manualId = manualBody.isEmpty() ? null : Json.string(manualBody.get(), "discord_id");
            if (manualId != null) {
                return CompletableFuture.completedFuture(new PlayerAccount(Mode.LINKED, manualId));
            }
            return links.discordIdFor(p.getName()).thenApply(opt -> {
                if (opt.isPresent()) return new PlayerAccount(Mode.LINKED, opt.get());
                if (state.isUnlinked(p.getUniqueId())) return new PlayerAccount(Mode.UNLINKED, null);
                return new PlayerAccount(Mode.PENDING, null);
            });
        });
    }

    /** Shows the greeting / choice prompt to a player who hasn't chosen. */
    public void promptPending(Player p) {
        p.sendMessage(ChatColor.translateAlternateColorCodes('&',
                plugin.getConfig().getString("pending-prompt",
                        "&e[AstralyxXP] &fYour account isn't connected to Discord yet.\n"
                                + "&a/xp link &7- connect Discord now (XP syncs everywhere)\n"
                                + "&a/xp bind <discordId> &7- link it manually (no code)\n"
                                + "&b/xp unlinked &7- grind Minecraft-only XP (won't ever sync to Discord)\n"
                                + "&cWarning: &7if you go unlinked, switching to linked later needs staff help.")));
    }

    private void offline(Player p) {
        p.sendMessage(ChatColor.RED + "Could not reach the linking/XP service right now. Try again later.");
    }

    /** Sends the async action result back on the main thread. */
    private void sendSync(Player p, Runnable action) {
        plugin.getServer().getScheduler().runTask(plugin, () -> {
            if (p.isOnline()) action.run();
        });
    }

    // ── View ───────────────────────────────────────────────────────────

    public CompletableFuture<PlayerAccount> view(Player p) {
        CompletableFuture<PlayerAccount> f = resolve(p);
        f.thenAccept(acc -> {
            if (acc.mode == Mode.LINKED) {
                xpApi.get("/api/xp/" + acc.discordId).whenComplete((body, err) -> {
                    if (err != null || body.isEmpty()) {
                        sendSync(p, () -> p.sendMessage(ChatColor.RED + "Failed to fetch your XP. Try again later."));
                        return;
                    }
                    String b = body.get();
                    long xp = Json.intValue(b, "xp");
                    int level = Json.intValue(b, "level");
                    int next = Json.intValue(b, "next_level_xp");
                    int prog = Json.intValue(b, "progress");
                    sendSync(p, () -> showView(p, xp, level, next, prog, false));
                });
            } else if (acc.mode == Mode.UNLINKED) {
                sendSync(p, () -> {
                    long xp = state.localXp(p.getUniqueId());
                    int level = Levels.level(xp);
                    Long next = Levels.nextThreshold(level);
                    int prog = Levels.progress(xp);
                    showView(p, xp, level, next == null ? 0 : (int) (long) next, prog, true);
                });
            } else if (acc.mode == Mode.PENDING) {
                sendSync(p, () -> promptPending(p));
            } else {
                sendSync(p, () -> offline(p));
            }
        });
        return f;
    }

    private void showView(Player p, long xp, int level, int next, int progress, boolean minecraftOnly) {
        p.sendMessage(ChatColor.GOLD + "◇━━━━ Astralyx XP ━━━━◇");
        p.sendMessage(ChatColor.GRAY + "Level: " + ChatColor.AQUA + level);
        p.sendMessage(ChatColor.GRAY + "XP: " + ChatColor.AQUA + xp
                + (next > 0 ? ChatColor.GRAY + " / " + next : ""));
        p.sendMessage(ChatColor.GRAY + "Progress: " + ChatColor.AQUA + progress + "%");
        if (minecraftOnly) {
            p.sendMessage(ChatColor.DARK_RED + "⚠ Minecraft-only XP — does NOT sync to Discord.");
        }
    }

    // ── Coinflip ───────────────────────────────────────────────────────

    public CompletableFuture<PlayerAccount> coinflip(Player p, String rawChoice, long amount) {
        if (amount < 10 || amount > 5000) {
            p.sendMessage(ChatColor.RED + "Amount must be between 10 and 5000 XP.");
            return CompletableFuture.completedFuture(null);
        }
        final String choice = rawChoice.toLowerCase();
        if (!choice.equals("heads") && !choice.equals("tails")) {
            p.sendMessage(ChatColor.RED + "Choice must be 'heads' or 'tails'.");
            return CompletableFuture.completedFuture(null);
        }

        CompletableFuture<PlayerAccount> f = resolve(p);
        f.thenAccept(acc -> {
            if (acc.mode == Mode.LINKED) {
                String json = "{" + Json.value("discord_id", acc.discordId)
                        + "," + Json.value("choice", choice)
                        + "," + Json.value("amount", amount) + "}";
                postGame(p, "/api/coinflip", json, body -> {
                    boolean win = "true".equals(Json.string(body, "win"));
                    String result = Json.string(body, "result");
                    long newXp = Json.intValue(body, "xp");
                    sendSync(p, () -> {
                        p.sendMessage(ChatColor.GOLD + "🪙 Coinflip");
                        if (win) {
                            p.sendMessage(ChatColor.GREEN + "It landed on " + (result == null ? choice : result)
                                    + "! You won " + amount + " XP! 🎉");
                        } else {
                            p.sendMessage(ChatColor.RED + "It landed on " + (result == null ? choice : result)
                                    + ". You lost " + amount + " XP. 😢");
                        }
                        p.sendMessage(ChatColor.GRAY + "New balance: " + ChatColor.AQUA + newXp);
                    });
                    return null;
                });
            } else if (acc.mode == Mode.UNLINKED) {
                final long oldXp = state.localXp(p.getUniqueId());
                if (oldXp < amount) {
                    p.sendMessage(ChatColor.RED + "You don't have enough XP. You only have " + oldXp + " XP.");
                    return;
                }
                boolean win = RNG.nextBoolean();
                String result = win ? choice : (choice.equals("heads") ? "tails" : "heads");
                long newXp = oldXp + (win ? amount : -amount);
                state.setLocalXp(p.getUniqueId(), newXp);
                Integer up = Levels.levelUp(oldXp, newXp);
                sendSync(p, () -> {
                    p.sendMessage(ChatColor.GOLD + "🪙 Coinflip");
                    if (win) {
                        p.sendMessage(ChatColor.GREEN + "It landed on " + result + "! You won " + amount + " XP! 🎉");
                    } else {
                        p.sendMessage(ChatColor.RED + "It landed on " + result + ". You lost " + amount + " XP. 😢");
                    }
                    p.sendMessage(ChatColor.GRAY + "New balance: " + ChatColor.AQUA + newXp);
                    if (up != null) {
                        p.sendMessage(ChatColor.LIGHT_PURPLE + "🎉 LEVEL UP! You are now level " + up + "! 🎉");
                    }
                });
            } else if (acc.mode == Mode.PENDING) {
                sendSync(p, () -> promptPending(p));
            } else {
                sendSync(p, () -> offline(p));
            }
        });
        return f;
    }

    // ── Slots ──────────────────────────────────────────────────────────

    public CompletableFuture<PlayerAccount> slots(Player p, long amount) {
        if (amount < 10 || amount > 5000) {
            p.sendMessage(ChatColor.RED + "Amount must be between 10 and 5000 XP.");
            return CompletableFuture.completedFuture(null);
        }

        CompletableFuture<PlayerAccount> f = resolve(p);
        f.thenAccept(acc -> {
            if (acc.mode == Mode.LINKED) {
                String json = "{" + Json.value("discord_id", acc.discordId)
                        + "," + Json.value("amount", amount) + "}";
                postGame(p, "/api/slots", json, body -> {
                    java.util.List<String> symbols = Json.strings(body, "symbols");
                    boolean jackpot = "true".equals(Json.string(body, "jackpot"));
                    boolean pair = "true".equals(Json.string(body, "pair"));
                    long newXp = Json.intValue(body, "xp");
                    long won = Math.max(0, Json.intValue(body, "win_amount"));
                    sendSync(p, () -> showSlots(p, symbols, jackpot, pair, won, newXp, null, false));
                    return null;
                });
            } else if (acc.mode == Mode.UNLINKED) {
                final long oldXp = state.localXp(p.getUniqueId());
                if (oldXp < amount) {
                    p.sendMessage(ChatColor.RED + "You don't have enough XP. You only have " + oldXp + " XP.");
                    return;
                }
                java.util.List<String> symbols = java.util.List.of(
                        SLOT_SYMBOLS[RNG.nextInt(SLOT_SYMBOLS.length)],
                        SLOT_SYMBOLS[RNG.nextInt(SLOT_SYMBOLS.length)],
                        SLOT_SYMBOLS[RNG.nextInt(SLOT_SYMBOLS.length)]);
                boolean jackpot = symbols.get(0).equals(symbols.get(1)) && symbols.get(1).equals(symbols.get(2));
                boolean pair = !jackpot && (symbols.get(0).equals(symbols.get(1))
                        || symbols.get(1).equals(symbols.get(2))
                        || symbols.get(0).equals(symbols.get(2)));
                long won = jackpot ? amount * 5 : 0;
                long newXp = jackpot ? oldXp + won : oldXp - amount;
                state.setLocalXp(p.getUniqueId(), newXp);
                Integer up = Levels.levelUp(oldXp, newXp);
                sendSync(p, () -> showSlots(p, symbols, jackpot, pair, won, newXp, up, true));
            } else if (acc.mode == Mode.PENDING) {
                sendSync(p, () -> promptPending(p));
            } else {
                sendSync(p, () -> offline(p));
            }
        });
        return f;
    }

    private void showSlots(Player p, java.util.List<String> symbols, boolean jackpot, boolean pair,
                           long won, long newXp, Integer up, boolean minecraftOnly) {
        String row = symbols.isEmpty()
                ? "[ ? | ? | ? ]"
                : "[" + String.join(" | ", symbols) + "]";
        p.sendMessage(ChatColor.GOLD + "🎰 Slots " + row);
        if (jackpot) {
            p.sendMessage(ChatColor.GREEN + "**JACKPOT!** You won 5x your bet (" + won + " XP)!");
        } else if (pair) {
            p.sendMessage(ChatColor.YELLOW + "So close! Two matched, but the jackpot needs all three.");
        } else {
            p.sendMessage(ChatColor.RED + "You lost. Better luck next time!");
        }
        p.sendMessage(ChatColor.GRAY + "New balance: " + ChatColor.AQUA + newXp);
        if (up != null) {
            p.sendMessage(ChatColor.LIGHT_PURPLE + "🎉 LEVEL UP! You are now level " + up + "! 🎉");
        }
        if (minecraftOnly) {
            p.sendMessage(ChatColor.DARK_RED + "⚠ Minecraft-only XP — does NOT sync to Discord.");
        }
    }

    // ── Daily ──────────────────────────────────────────────────────────

    public CompletableFuture<PlayerAccount> daily(Player p) {
        CompletableFuture<PlayerAccount> f = resolve(p);
        f.thenAccept(acc -> {
            if (acc.mode == Mode.LINKED) {
                String json = "{" + Json.value("discord_id", acc.discordId) + "}";
                postGame(p, "/api/daily", json, body -> {
                    long reward = Json.intValue(body, "reward");
                    int streak = (int) Json.intValue(body, "streak");
                    long newXp = Json.intValue(body, "xp");
                    sendSync(p, () -> {
                        p.sendMessage(ChatColor.GOLD + "📅 Daily Claimed!");
                        p.sendMessage(ChatColor.GREEN + "You claimed " + reward + " XP! 🎁");
                        p.sendMessage(ChatColor.GRAY + "Streak: " + ChatColor.AQUA + streak + " 🔥");
                        p.sendMessage(ChatColor.GRAY + "New balance: " + ChatColor.AQUA + newXp);
                    });
                    return null;
                });
            } else if (acc.mode == Mode.UNLINKED) {
                final long now = System.currentTimeMillis();
                final long last = state.lastClaim(p.getUniqueId());
                if (now - last < DAY_MS) {
                    long remMs = DAY_MS - (now - last);
                    long hrs = remMs / (60 * 60 * 1000);
                    long mins = (remMs % (60 * 60 * 1000)) / (60 * 1000);
                    p.sendMessage(ChatColor.RED + "You can claim your next daily reward in "
                            + hrs + "h " + mins + "m.");
                    return;
                }
                int streak = state.dailyStreak(p.getUniqueId()) + 1;
                if (last == 0) streak = 1;
                final int finalStreak = streak;
                long reward = 10 + (streak / 3) * 5;
                long oldXp = state.localXp(p.getUniqueId());
                long newXp = oldXp + reward;
                state.setLocalXp(p.getUniqueId(), newXp);
                state.setDailyStreak(p.getUniqueId(), finalStreak);
                state.markClaimed(p.getUniqueId());
                Integer up = Levels.levelUp(oldXp, newXp);
                sendSync(p, () -> {
                    p.sendMessage(ChatColor.GOLD + "📅 Daily Claimed!");
                    p.sendMessage(ChatColor.GREEN + "You claimed " + reward + " XP! 🎁");
                    p.sendMessage(ChatColor.GRAY + "Streak: " + ChatColor.AQUA + finalStreak + " 🔥");
                    p.sendMessage(ChatColor.GRAY + "New balance: " + ChatColor.AQUA + newXp);
                    if (up != null) {
                        p.sendMessage(ChatColor.LIGHT_PURPLE + "🎉 LEVEL UP! You are now level " + up + "! 🎉");
                    }
                });
            } else if (acc.mode == Mode.PENDING) {
                sendSync(p, () -> promptPending(p));
            } else {
                sendSync(p, () -> offline(p));
            }
        });
        return f;
    }

    // ── Transfer ───────────────────────────────────────────────────────

    public CompletableFuture<PlayerAccount> transfer(Player p, String targetName, long amount) {
        if (amount < 1) {
            p.sendMessage(ChatColor.RED + "Amount must be at least 1 XP.");
            return CompletableFuture.completedFuture(null);
        }
        Player target = Bukkit.getPlayerExact(targetName);
        if (target == null) {
            p.sendMessage(ChatColor.RED + "That player isn't online.");
            return CompletableFuture.completedFuture(null);
        }
        if (target.getUniqueId().equals(p.getUniqueId())) {
            p.sendMessage(ChatColor.RED + "You cannot transfer XP to yourself.");
            return CompletableFuture.completedFuture(null);
        }

        CompletableFuture<PlayerAccount> f = resolve(p);
        f.thenAccept(acc -> {
            if (acc.mode == Mode.LINKED) {
                links.discordIdFor(targetName).whenComplete((targetOpt, err) -> {
                    if (err != null || targetOpt.isEmpty()) {
                        sendSync(p, () -> p.sendMessage(ChatColor.RED + targetName + " isn't linked to Discord, so you can't send them XP."));
                        return;
                    }
                    String json = "{" + Json.value("from", acc.discordId)
                            + "," + Json.value("to", targetOpt.get())
                            + "," + Json.value("amount", amount) + "}";
                    postGame(p, "/api/transfer", json, body -> {
                        long mine = Json.intValue(body, "newSenderXP");
                        sendSync(p, () -> {
                            p.sendMessage(ChatColor.GREEN + "💸 Transferred " + amount + " XP to " + target.getName() + "!");
                            p.sendMessage(ChatColor.GRAY + "Your new balance: " + ChatColor.AQUA + mine);
                        });
                        return null;
                    });
                });
            } else if (acc.mode == Mode.UNLINKED) {
                final long mine = state.localXp(p.getUniqueId());
                if (mine < amount) {
                    p.sendMessage(ChatColor.RED + "You don't have enough XP. You only have " + mine + " XP.");
                    return;
                }
                state.setLocalXp(p.getUniqueId(), mine - amount);
                state.addLocalXp(target.getUniqueId(), amount);
                sendSync(p, () -> {
                    p.sendMessage(ChatColor.GREEN + "💸 Transferred " + amount + " XP to " + target.getName() + "!");
                    p.sendMessage(ChatColor.GRAY + "Your new balance: " + ChatColor.AQUA + (mine - amount));
                });
            } else if (acc.mode == Mode.PENDING) {
                sendSync(p, () -> promptPending(p));
            } else {
                sendSync(p, () -> offline(p));
            }
        });
        return f;
    }

    // ── Link management ────────────────────────────────────────────────

    public void link(Player p) {
        resolve(p).thenAccept(acc -> {
            if (acc.mode == Mode.LINKED) {
                sendSync(p, () -> p.sendMessage(ChatColor.GREEN + "You're already linked to Discord. Your XP syncs everywhere!"));
            } else if (acc.mode == Mode.UNLINKED) {
                sendSync(p, () -> p.sendMessage(ChatColor.translateAlternateColorCodes('&',
                        "&cYou chose the unlinked path, so there is &cNO /link &cfor you.\n"
                                + "&7If you want to switch to linked later, staff must merge your account — just ask.")));
            } else {
                sendSync(p, () -> p.sendMessage(ChatColor.translateAlternateColorCodes('&',
                        plugin.getConfig().getString("link-prompt",
                                "&eTo link your account:\n"
                                        + "&a1. &fRun &e/linkaccount &fin Minecraft, then &e/link <username> <code> &fin the AstralyxPvP Discord\n"
                                        + "&a2. &fManual: &e/xp bind <discordId> &7(links your XP account directly, no code)\n"
                                        + "&7Once linked, your XP syncs between Minecraft and Discord."))));
            }
        });
    }

    public void chooseUnlinked(Player p) {
        resolve(p).thenAccept(acc -> {
            if (acc.mode == Mode.LINKED) {
                sendSync(p, () -> p.sendMessage(ChatColor.GREEN + "You're already linked to Discord. Your XP syncs everywhere!"));
            } else if (acc.mode == Mode.UNLINKED) {
                sendSync(p, () -> p.sendMessage(ChatColor.YELLOW + "You're already playing unlinked. Grind on! ⛏️"));
            } else {
                sendSync(p, () -> {
                    state.setUnlinked(p.getUniqueId());
                    p.sendMessage(ChatColor.translateAlternateColorCodes('&',
                            "&b[AstralyxXP] &fYou chose the unlinked path.\n"
                                    + "&7Your XP stays on &eMinecraft&7 and will &cnever sync to Discord&7 — "
                                    + "your Discord shows a different XP.\n"
                                    + "&cThere is NO /link later: &7switching to linked requires staff to merge manually.\n"
                                    + "&aGrind on! /daily, /coinflip, /slots and /transfer all work with Minecraft-only XP."));
                });
            }
        });
    }

    /**
     * Manual link: binds this Minecraft account's XP to a Discord user ID on
     * the XP worker (astralyx_xp D1 linked_accounts). Only links the XP
     * account — the private /linkaccount ELO/rank link is separate.
     *
     * If the player had been grinding Minecraft-only XP, the higher of their
     * local XP and the Discord account's current XP is kept (merge).
     */
    public void bind(Player p, String discordId) {
        final String id = discordId == null ? "" : discordId.trim();
        if (!id.matches("\\d{15,20}")) {
            p.sendMessage(ChatColor.RED + "Usage: /xp bind <discordId> — your Discord user ID. Find it in Discord: Settings → Advanced → Developer Mode, then right-click your name → Copy User ID.");
            return;
        }
        final long local = state.localXp(p.getUniqueId());
        String json = "{" + Json.value("discord_id", id)
                + "," + Json.value("minecraft_uuid", p.getUniqueId().toString())
                + "," + Json.value("minecraft_name", p.getName())
                + "," + Json.value("merge_xp", local) + "}";
        xpApi.post("/api/link", json).whenComplete((body, err) -> {
            if (err != null || body.isEmpty()) {
                sendSync(p, () -> p.sendMessage(ChatColor.RED + "Could not reach the XP service. Try again later."));
                return;
            }
            String b = body.get();
            boolean ok = "true".equals(Json.string(b, "success"));
            if (!ok) {
                String e = Json.string(b, "error");
                sendSync(p, () -> p.sendMessage(ChatColor.RED + "Link failed: " + (e == null ? "unknown error" : e)));
                return;
            }
            final long finalXp = Json.intValue(b, "xp");
            final String picked = Json.string(b, "picked");
            state.setLocalXp(p.getUniqueId(), 0); // XP now lives on the Discord side; avoid a future double-merge
            sendSync(p, () -> {
                p.sendMessage(ChatColor.GREEN + "✅ Bound! Minecraft → Discord " + id + " (XP account).");
                if ("minecraft".equals(picked)) {
                    p.sendMessage(ChatColor.GOLD + "Your Minecraft XP (" + local + ") was higher, so it was kept. 🎉");
                } else {
                    p.sendMessage(ChatColor.GRAY + "New XP balance: " + ChatColor.AQUA + finalXp);
                }
                p.sendMessage(ChatColor.GRAY + "This link overrides /linkaccount if they ever conflict.");
            });
        });
    }

    // ── HTTP helper ────────────────────────────────────────────────────

    private void postGame(Player p, String path, String json, java.util.function.Function<String, Void> onOk) {
        xpApi.post(path, json).whenComplete((body, err) -> {
            if (err != null || body.isEmpty()) {
                sendSync(p, () -> p.sendMessage(ChatColor.RED + "Failed. Try again later."));
                return;
            }
            sendSync(p, () -> onOk.apply(body.get()));
        });
    }
}