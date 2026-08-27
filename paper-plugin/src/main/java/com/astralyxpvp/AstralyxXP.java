package com.astralyxpvp;

import org.bukkit.plugin.java.JavaPlugin;

public final class AstralyxXP extends JavaPlugin {

    @Override
    public void onEnable() {
        saveDefaultConfig();

        ApiClient linkApi = new ApiClient(
                getConfig().getString("link-worker-url", ""),
                ""
        );
        ApiClient xpApi = new ApiClient(
                getConfig().getString("api-base-url", ""),
                getConfig().getString("api-secret", "")
        );

        XpCommand xpCommand = new XpCommand(this, linkApi, xpApi);
        getCommand("xp").setExecutor(xpCommand);
        getCommand("leaderboard").setExecutor(new LeaderboardCommand(this, xpApi));

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
        getLogger().info("AstralyxXP disabled.");
    }
}