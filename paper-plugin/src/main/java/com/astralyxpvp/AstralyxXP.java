package com.astralyxpvp;

import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerExpChangeEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.event.player.PlayerRespawnEvent;

public final class AstralyxXP extends JavaPlugin implements Listener {

    private LinkState state;
    private XpActions actions;

    @Override
    public void onEnable() {
        saveDefaultConfig();

        state = new LinkState(getDataFolder());

        ApiClient linkApi = new ApiClient(
                getConfig().getString("link-worker-url", ""),
                ""
        );
        ApiClient xpApi = new ApiClient(
                getConfig().getString("api-base-url", ""),
                getConfig().getString("api-secret", "")
        );

        LinkResolver links = new LinkResolver(linkApi);
        actions = new XpActions(this, links, xpApi, state);

        getCommand("xp").setExecutor(new XpCommand(actions));
        getCommand("balance").setExecutor(new BalanceCommand(actions));
        getCommand("daily").setExecutor(new DailyCommand(actions));
        getCommand("coinflip").setExecutor(new CoinflipCommand(actions));
        getCommand("slots").setExecutor(new SlotsCommand(actions));
        getCommand("transfer").setExecutor(new TransferCommand(actions));
        getCommand("leaderboard").setExecutor(new LeaderboardCommand(this, xpApi));
        getCommand("astralyxxp").setExecutor(new XpScriptCommand(actions));

        getServer().getPluginManager().registerEvents(new JoinListener(this, links, state), this);
        getServer().getPluginManager().registerEvents(this, this);
        if (getServer().getPluginManager().isPluginEnabled("PlaceholderAPI")) {
            new AstralyxXPPlaceholders(this, "astralyx").register();
            new AstralyxXPPlaceholders(this, "astralyxxp").register();
            getLogger().info("PlaceholderAPI expansions registered: %astralyx_*% and %astralyxxp_*%");
        }

        long syncIntervalTicks = Math.max(20L,
                getConfig().getLong("xp-bar-sync-interval-seconds", 30L) * 20L);
        Bukkit.getScheduler().runTaskTimer(this, () -> Bukkit.getOnlinePlayers()
                .forEach(actions::refreshXpCache), 20L, syncIntervalTicks);

        getServer().getConsoleSender().sendMessage("""
                ===========================================
                ===========================================
                ASTRALYXXP
                ===========================================
                Built by IndianCoder3, for AstralyxPvP
                ===========================================
                [IC3/AstralyxXP] Plugin has started!""");
    }

    @Override
    public void onDisable() {
        Bukkit.getOnlinePlayers().forEach(player -> XpSnapshot.remove(player.getUniqueId()));
        getLogger().info("AstralyxXP disabled.");
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        player.setTotalExperience(0);
        player.setLevel(0);
        player.setExp(0.0f);
        Bukkit.getScheduler().runTaskLater(this,
                () -> refreshPlayerXp(player), 10L);
    }

    @EventHandler
    public void onRespawn(PlayerRespawnEvent event) {
        Bukkit.getScheduler().runTaskLater(this,
                () -> refreshPlayerXp(event.getPlayer()), 1L);
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        XpSnapshot.remove(event.getPlayer().getUniqueId());
    }

    @EventHandler(ignoreCancelled = true)
    public void onVanillaXp(PlayerExpChangeEvent event) {
        event.setAmount(0);
    }

    private void refreshPlayerXp(Player player) {
        if (!player.isOnline()) {
            return;
        }
        actions.refreshXpCache(player);
    }
}