package com.astralyxpvp;

import org.bukkit.plugin.java.JavaPlugin;

public final class AstralyxXP extends JavaPlugin {

    private LinkState state;

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
        XpActions actions = new XpActions(this, links, xpApi, state);

        getCommand("xp").setExecutor(new XpCommand(actions));
        getCommand("balance").setExecutor(new BalanceCommand(actions));
        getCommand("daily").setExecutor(new DailyCommand(actions));
        getCommand("coinflip").setExecutor(new CoinflipCommand(actions));
        getCommand("slots").setExecutor(new SlotsCommand(actions));
        getCommand("transfer").setExecutor(new TransferCommand(actions));
        getCommand("leaderboard").setExecutor(new LeaderboardCommand(this, xpApi));

        getServer().getPluginManager().registerEvents(new JoinListener(this, links, state), this);

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