package com.astralyxpvp;

import java.security.SecureRandom;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.command.CommandSender;
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

    private static final long WARNING_THROTTLE_MS = 60_000L;
    private final java.util.Map<java.util.UUID, Long> lastWarningTimeByPlayer = new java.util.concurrent.ConcurrentHashMap<>();

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

    public void refreshXpCache(Player player) {
        resolve(player).whenComplete((account, resolveError) -> {
            if (resolveError != null || account == null) {
                plugin.getLogger().warning("Could not resolve XP account for " + player.getName()
                        + (resolveError == null ? "." : ": " + resolveError.getMessage()));
                return;
            }
            if (account.mode == Mode.UNLINKED) {
                sendSync(player, () -> updateCachedXp(player, state.localXp(player.getUniqueId())));
                return;
            }
            if (account.mode != Mode.LINKED) {
                sendSync(player, () -> XpSnapshot.remove(player.getUniqueId()));
                return;
            }

            CompletableFuture<ApiClient.ApiResponse> xpResponse =
                    xpApi.getDetailed("/api/xp/" + account.discordId);
            CompletableFuture<ApiClient.ApiResponse> statsResponse =
                    xpApi.getDetailed("/api/minecraft/stats/" + player.getUniqueId());
            xpResponse.thenCombine(statsResponse, CachedAccountStats::new)
                    .whenComplete((stats, error) -> {
                if (error != null || stats == null || !stats.xpResponse.isSuccessful()) {
                    long now = System.currentTimeMillis();
                    Long lastWarning = lastWarningTimeByPlayer.get(player.getUniqueId());
                    if (lastWarning == null || (now - lastWarning >= WARNING_THROTTLE_MS)) {
                        lastWarningTimeByPlayer.put(player.getUniqueId(), now);
                        String details;
                        if (error != null) {
                            details = error.getClass().getSimpleName() + ": " + error.getMessage();
                        } else if (stats == null) {
                            details = "API requests completed without response data";
                        } else {
                            details = responseFailure("XP lookup", stats.xpResponse) + "; "
                                    + responseFailure("Minecraft stats lookup", stats.statsResponse);
                        }
                        plugin.getLogger().warning("Could not refresh Astralyx XP for "
                                + player.getName() + ": " + details);
                    }
                    return;
                }

                // XP lookup succeeded; check if stats lookup failed
                if (!stats.statsResponse.isSuccessful()) {
                    long now = System.currentTimeMillis();
                    Long lastWarning = lastWarningTimeByPlayer.get(player.getUniqueId());
                    if (lastWarning == null || (now - lastWarning >= WARNING_THROTTLE_MS)) {
                        lastWarningTimeByPlayer.put(player.getUniqueId(), now);
                        plugin.getLogger().warning("Could not refresh Minecraft kill stats for "
                                + player.getName() + ": " + responseFailure("Minecraft stats lookup", stats.statsResponse));
                    }
                }

                long xp;
                try {
                    xp = Json.intValue(stats.xpResponse.body(), "xp");
                } catch (RuntimeException parseError) {
                    plugin.getLogger().warning("Could not parse Astralyx XP refresh response for "
                            + player.getName() + ": " + parseError.getMessage());
                    return;
                }

                long kills = 0L;
                if (stats.statsResponse.isSuccessful()) {
                    try {
                        kills = Math.max(0L, Json.intValue(stats.statsResponse.body(), "kills"));
                    } catch (RuntimeException ignored) {
                        // Keep previous or 0 kills if stats body parse fails
                    }
                } else {
                    XpSnapshot existing = XpSnapshot.get(player.getUniqueId());
                    if (existing != null) {
                        kills = existing.kills();
                    }
                }

                final long finalKills = kills;
                sendSync(player, () -> updateCachedXp(player, xp, finalKills));
            });
        });
    }

    private String responseFailure(String endpoint, ApiClient.ApiResponse response) {
        if (response.isSuccessful()) {
            return endpoint + " succeeded";
        }
        return endpoint + (response.statusCode() < 0
                ? " failed: " + response.error()
                : " returned HTTP " + response.statusCode());
    }

    public XpSnapshot cachedXp(Player player) {
        return XpSnapshot.get(player.getUniqueId());
    }

    public void queryXp(CommandSender sender, Player target) {
        resolve(target).whenComplete((account, resolveError) -> {
            if (resolveError != null || account == null) {
                sendSender(sender, () -> sender.sendMessage(ChatColor.RED + "Could not resolve that XP account."));
                return;
            }
            if (account.mode == Mode.UNLINKED) {
                long xp = state.localXp(target.getUniqueId());
                sendSender(sender, () -> sender.sendMessage(ChatColor.GREEN + "ASTRALYXXP_XP "
                        + target.getName() + " " + xp));
                return;
            }
            if (account.mode != Mode.LINKED) {
                sendSender(sender, () -> sender.sendMessage(ChatColor.RED
                        + target.getName() + " has no available Astralyx XP account."));
                return;
            }
            xpApi.get("/api/xp/" + account.discordId).whenComplete((body, error) -> {
                if (error != null || body.isEmpty()) {
                    sendSender(sender, () -> sender.sendMessage(ChatColor.RED + "Could not query Astralyx XP."));
                    return;
                }
                long xp = Json.intValue(body.get(), "xp");
                sendSender(sender, () -> sender.sendMessage(ChatColor.GREEN + "ASTRALYXXP_XP "
                        + target.getName() + " " + xp));
            });
        });
    }

    public void giveXp(CommandSender sender, Player target, long amount) {
        if (amount < 1 || amount > 5000) {
            sendSender(sender, () -> sender.sendMessage(ChatColor.RED
                    + "XP amount must be between 1 and 5000."));
            return;
        }
        resolve(target).whenComplete((account, resolveError) -> {
            if (resolveError != null || account == null) {
                sendSender(sender, () -> sender.sendMessage(ChatColor.RED + "Could not resolve that XP account."));
                return;
            }
            if (account.mode == Mode.UNLINKED) {
                plugin.getServer().getScheduler().runTask(plugin, () -> {
                    long oldXp = state.localXp(target.getUniqueId());
                    long newXp = oldXp > Long.MAX_VALUE - amount ? Long.MAX_VALUE : oldXp + amount;
                    state.setLocalXp(target.getUniqueId(), newXp);
                    updateCachedXp(target, newXp);
                    if (target.isOnline()) {
                        target.sendMessage(ChatColor.GREEN + "You received " + amount + " Astralyx XP.");
                    }
                    sender.sendMessage(ChatColor.GREEN + "Gave " + amount
                            + " Minecraft-only Astralyx XP to " + target.getName() + ".");
                });
                return;
            }
            if (account.mode != Mode.LINKED) {
                sendSync(target, () -> promptPending(target));
                sendSender(sender, () -> sender.sendMessage(ChatColor.RED
                        + target.getName() + " needs to link an Astralyx XP account first."));
                return;
            }

            String eventId = "script:" + java.util.UUID.randomUUID();
            String json = "{" + Json.value("minecraft_uuid", target.getUniqueId().toString())
                    + "," + Json.value("event_id", eventId)
                    + "," + Json.value("amount", amount)
                    + "," + Json.value("reason", "script") + "}";
            xpApi.post("/api/minecraft/reward", json).whenComplete((body, error) -> {
                if (error != null || body.isEmpty() || !"true".equals(Json.string(body.get(), "success"))) {
                    sendSender(sender, () -> sender.sendMessage(ChatColor.RED
                            + "Could not grant Astralyx XP. The XP service may need its schema update."));
                    return;
                }
                long newXp = Json.intValue(body.get(), "xp");
                sendSync(target, () -> {
                    updateCachedXp(target, newXp);
                    target.sendMessage(ChatColor.GREEN + "You received " + amount + " Astralyx XP.");
                });
                sendSender(sender, () -> sender.sendMessage(ChatColor.GREEN + "Gave " + amount
                        + " Astralyx XP to " + target.getName() + "."));
            });
        });
    }

    private void updateCachedXp(Player player, long xp) {
        XpSnapshot previous = XpSnapshot.get(player.getUniqueId());
        updateCachedXp(player, xp, previous == null ? 0L : previous.kills());
    }

    private void updateCachedXp(Player player, long xp, long kills) {
        XpSnapshot previous = XpSnapshot.get(player.getUniqueId());
        XpSnapshot current = XpSnapshot.from(xp, kills);
        XpSnapshot.put(player.getUniqueId(), current);
        if (player.isOnline()) {
            player.setLevel(current.level());
            player.setExp((float) current.progress());
        }
        if (previous != null && current.level() > previous.level()) {
            Bukkit.broadcastMessage(ChatColor.LIGHT_PURPLE + "★ " + player.getName()
                    + " just leveled up! They reached Astralyx level " + current.level()
                    + " (" + xp + " XP)!");
        }
    }

    private record CachedAccountStats(ApiClient.ApiResponse xpResponse,
                                      ApiClient.ApiResponse statsResponse) {
    }

    private void sendSender(CommandSender sender, Runnable action) {
        plugin.getServer().getScheduler().runTask(plugin, action);
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
                String mergeNote;
                if ("minecraft".equals(picked)) {
                    String note = plugin.getConfig().getString("bind-merge-minecraft");
                    mergeNote = note == null
                            ? "\n&6Your " + local + " MC XP was higher — it's now your Discord balance! 💪"
                            : "\n" + note.replace("{xp}", String.valueOf(local));
                } else {
                    String note = plugin.getConfig().getString("bind-keep-discord");
                    mergeNote = note == null
                            ? "\n&7Kept your existing Discord XP balance (" + finalXp + ")."
                            : "\n" + note.replace("{xp}", String.valueOf(finalXp));
                }
                String msg = plugin.getConfig().getString("bind-success",
                        "&e[AstralyxXP] &aYour Minecraft account is now linked to Discord &7{discordId}&a!\n"
                                + "&7Your XP syncs between Minecraft and Discord now.{merge_note}");
                p.sendMessage(ChatColor.translateAlternateColorCodes('&',
                        msg.replace("{discordId}", id).replace("{merge_note}", mergeNote)));
                p.sendMessage(ChatColor.GRAY + "Manual link overrides /linkaccount if they ever conflict.");
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