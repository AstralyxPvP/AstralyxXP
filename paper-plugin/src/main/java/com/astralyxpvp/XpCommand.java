package com.astralyxpvp;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.bukkit.ChatColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;

public final class XpCommand implements CommandExecutor {

    private final AstralyxXP plugin;
    private final ApiClient api;

    public XpCommand(AstralyxXP plugin, ApiClient api) {
        this.plugin = plugin;
        this.api = api;
    }

    @Override
    public boolean onCommand(@NotNull CommandSender sender, @NotNull Command command, @NotNull String label, @NotNull String[] args) {
        if (!(sender instanceof Player)) {
            sender.sendMessage(ChatColor.RED + "Only players can run this command.");
            return true;
        }
        Player p = (Player) sender;
        UUID uuid = p.getUniqueId();

        p.sendMessage(ChatColor.GRAY + "Fetching your Astralyx XP...");

        api.get("/api/linked/" + uuid.toString()).whenComplete((linked, err) -> {
            if (err != null || linked.isEmpty()) {
                sendSync(p, () -> p.sendMessage(ChatColor.translateAlternateColorCodes('&',
                        plugin.getConfig().getString("link-prompt", "&cYou are not linked. Run /linkaccount first."))));
                return;
            }
            String discordId = Json.string(linked.get(), "discord_id");
            if (discordId == null) {
                sendSync(p, () -> p.sendMessage(ChatColor.translateAlternateColorCodes('&',
                        plugin.getConfig().getString("link-prompt", "&cYou are not linked. Run /linkaccount first."))));
                return;
            }

            api.get("/api/xp/" + discordId).whenComplete((xpRes, xpErr) -> {
                if (xpErr != null || xpRes.isEmpty()) {
                    sendSync(p, () -> p.sendMessage(ChatColor.RED + "Failed to fetch your XP. Try again later."));
                    return;
                }
                String body = xpRes.get();
                long xp = Json.intValue(body, "xp");
                int level = Json.intValue(body, "level");
                int next = Json.intValue(body, "next_level_xp");
                int progress = Json.intValue(body, "progress");

                sendSync(p, () -> {
                    p.sendMessage(ChatColor.GOLD + "◇━━━━ Astralyx XP ━━━━◇");
                    p.sendMessage(ChatColor.GRAY + "Level: " + ChatColor.AQUA + level);
                    p.sendMessage(ChatColor.GRAY + "XP: " + ChatColor.AQUA + xp + ChatColor.GRAY + " / " + next);
                    p.sendMessage(ChatColor.GRAY + "Progress to next level: " + ChatColor.AQUA + progress + "%");
                });
            });
        });
        return true;
    }

    /** Runs the action on the server main thread (Bukkit API is not thread-safe). */
    private void sendSync(Player p, Runnable action) {
        plugin.getServer().getScheduler().runTask(plugin, () -> {
            if (p.isOnline()) action.run();
        });
    }
}