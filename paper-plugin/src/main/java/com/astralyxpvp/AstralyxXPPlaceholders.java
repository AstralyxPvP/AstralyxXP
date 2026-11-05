package com.astralyxpvp;

import me.clip.placeholderapi.expansion.PlaceholderExpansion;
import org.bukkit.OfflinePlayer;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

public final class AstralyxXPPlaceholders extends PlaceholderExpansion {

    private final AstralyxXP plugin;
    private final String identifier;

    public AstralyxXPPlaceholders(AstralyxXP plugin, String identifier) {
        this.plugin = plugin;
        this.identifier = identifier;
    }

    @Override
    public @NotNull String getIdentifier() {
        return identifier;
    }

    @Override
    public @NotNull String getAuthor() {
        return "AstralyxPvP";
    }

    @Override
    public @NotNull String getVersion() {
        return plugin.getDescription().getVersion();
    }

    @Override
    public boolean persist() {
        return true;
    }

    @Override
    public @Nullable String onRequest(OfflinePlayer player, @NotNull String params) {
        if (player == null) {
            return null;
        }
        XpSnapshot snapshot = XpSnapshot.get(player.getUniqueId());
        if (snapshot == null) {
            return null;
        }
        return switch (params.toLowerCase(java.util.Locale.ROOT)) {
            case "xp" -> Long.toString(snapshot.totalXp());
            case "level" -> Integer.toString(snapshot.level());
            case "progress" -> Integer.toString((int) Math.floor(snapshot.progress() * 100.0));
            case "xp_into_level" -> Long.toString(snapshot.xpIntoLevel());
            case "xp_to_next_level" -> Long.toString(snapshot.xpToNextLevel());
            case "kills" -> Long.toString(snapshot.kills());
            default -> null;
        };
    }
}
