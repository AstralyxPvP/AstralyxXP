package com.astralyxpvp;

import java.util.List;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.jetbrains.annotations.NotNull;

public final class LeaderboardCommand implements CommandExecutor {

    private final AstralyxXP plugin;
    private final ApiClient api;

    public LeaderboardCommand(AstralyxXP plugin, ApiClient api) {
        this.plugin = plugin;
        this.api = api;
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command, @NotNull String label, @NotNull String[] args) {
        int limit = 10;
        if (args.length > 0) {
            try {
                limit = Math.max(1, Math.min(Integer.parseInt(args[0]), 50));
            } catch (NumberFormatException e) {
                sender.sendMessage(ChatColor.RED + "Usage: /leaderboard [limit]");
                return true;
            }
        }

        sender.sendMessage(ChatColor.GRAY + "Fetching the Astralyx XP leaderboard...");
        api.get("/api/leaderboard?limit=" + limit).whenComplete((res, err) -> {
            if (err != null || res.isEmpty()) {
                sendSync(sender, () -> sender.sendMessage(ChatColor.RED + "Failed to fetch the leaderboard. Try again later."));
                return;
            }
            List<String> entries = Json.objects(res.get(), "leaderboard");
            sendSync(sender, () -> {
                sender.sendMessage(ChatColor.GOLD + "◇━━━ Astralyx XP Leaderboard ━━━◇");
                if (entries.isEmpty()) {
                    sender.sendMessage(ChatColor.GRAY + "No leaderboard data yet.");
                    return;
                }
                for (String entry : entries) {
                    int rank = Json.intValue(entry, "rank");
                    String discordId = Json.string(entry, "discord_id");
                    long xp = Json.intValue(entry, "xp");
                    int level = Json.intValue(entry, "level");
                    String name = (discordId == null || discordId.isEmpty())
                            ? "Unknown"
                            : "<@" + discordId + ">";
                    sender.sendMessage(ChatColor.AQUA + "#" + rank + " " + ChatColor.WHITE + name
                            + ChatColor.GRAY + " — Lv." + level + " · " + ChatColor.GOLD + xp + " XP");
                }
            });
        });
        return true;
    }

    private void sendSync(CommandSender sender, Runnable action) {
        boolean isPlayer = sender instanceof org.bukkit.entity.Player;
        if (isPlayer) {
            plugin.getServer().getScheduler().runTask(plugin, action);
        } else {
            action.run();
        }
    }
}