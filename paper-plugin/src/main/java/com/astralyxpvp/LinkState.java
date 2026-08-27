package com.astralyxpvp;

import java.io.File;
import java.io.IOException;
import java.util.UUID;
import org.bukkit.configuration.file.YamlConfiguration;

/**
 * Local link-mode + in-game XP storage (players.yml in the plugin folder).
 *
 * Modes:
 *   pending   - no decision yet (first join / data reset)
 *   unlinked  - grinding Minecraft-only XP (never synced to Discord)
 *   linked    - linked via the worker KV (discord_link) - remote XP is the record
 *
 * XP stored here is ONLY used for unlinked players; linked players fetch their
 * XP from the AstralyxXP worker.
 */
public final class LinkState {

    private final File file;
    private YamlConfiguration data;

    public LinkState(File folder) {
        this.file = new File(folder, "players.yml");
        this.data = YamlConfiguration.loadConfiguration(file);
    }

    public synchronized String mode(UUID uuid) {
        return data.getString(uuid + ".mode", "pending");
    }

    public synchronized boolean isUnlinked(UUID uuid) {
        return "unlinked".equals(mode(uuid));
    }

    public synchronized void setUnlinked(UUID uuid) {
        data.set(uuid + ".mode", "unlinked");
        save();
    }

    public synchronized long localXp(UUID uuid) {
        return data.getLong(uuid + ".xp", 0L);
    }

    public synchronized void setLocalXp(UUID uuid, long xp) {
        data.set(uuid + ".xp", Math.max(0L, xp));
        save();
    }

    public synchronized void addLocalXp(UUID uuid, long amount) {
        setLocalXp(uuid, localXp(uuid) + amount);
    }

    public synchronized long lastClaim(UUID uuid) {
        return data.getLong(uuid + ".last_claim", 0L);
    }

    public synchronized void markClaimed(UUID uuid) {
        data.set(uuid + ".last_claim", System.currentTimeMillis());
        save();
    }

    public synchronized int dailyStreak(UUID uuid) {
        return data.getInt(uuid + ".daily_streak", 0);
    }

    public synchronized void setDailyStreak(UUID uuid, int streak) {
        data.set(uuid + ".daily_streak", Math.max(0, streak));
        save();
    }

    private void save() {
        try {
            data.save(file);
        } catch (IOException e) {
            // Not fatal - file will be re-saved on the next change.
        }
    }
}