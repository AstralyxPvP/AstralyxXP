package com.astralyxpvp;

import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;

/**
 * On join, resolves the player's mode. Pending players (never chose, and not
 * linked) get greeted with the choice prompt. Linked / unlinked players stay
 * quiet so we don't spam every join.
 */
public final class JoinListener implements Listener {

    private final AstralyxXP plugin;
    private final LinkResolver links;
    private final LinkState state;

    public JoinListener(AstralyxXP plugin, LinkResolver links, LinkState state) {
        this.plugin = plugin;
        this.links = links;
        this.state = state;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onJoin(PlayerJoinEvent event) {
        Player p = event.getPlayer();
        if (state.isUnlinked(p.getUniqueId())) {
            return;
        }
        links.discordIdFor(p.getName()).whenComplete((opt, err) -> {
            if (err != null || opt.isEmpty()) {
                // Not linked (or service hiccup) - greet with the choice.
                plugin.getServer().getScheduler().runTask(plugin, () -> {
                    if (p.isOnline()) greet(p);
                });
            }
            // Linked players need no greeting.
        });
    }

    private void greet(Player p) {
        p.sendMessage(org.bukkit.ChatColor.translateAlternateColorCodes('&',
                plugin.getConfig().getString("join-greeting",
                        "&e[AstralyxXP] &fHey &e" + p.getName() + "&f!\n"
                                + "&7Your Discord isn't linked to your Minecraft account yet.\n"
                                + "&a/xp link &7- connect now, your XP syncs everywhere\n"
                                + "&b/xp unlinked &7- grind Minecraft-only XP (won't sync, no /link later)\n"
                                + "&cWarning: &7unlinked XP never reaches your Discord, and staff must merge if you switch.")));
    }
}