package com.astralyxpvp;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

public record XpSnapshot(long totalXp, int level, double progress, long xpIntoLevel,
                         long xpToNextLevel, long kills) {

    private static final ConcurrentMap<UUID, XpSnapshot> ONLINE = new ConcurrentHashMap<>();

    public static XpSnapshot from(long totalXp) {
        return from(totalXp, 0L);
    }

    public static XpSnapshot from(long totalXp, long kills) {
        int level = Levels.level(totalXp);
        Long next = Levels.nextThreshold(level);
        long intoLevel = totalXp - Levels.threshold(level);
        long toNext = next == null ? 0 : next - totalXp;
        double progress = next == null ? 1.0
                : Math.max(0.0, Math.min(1.0, (double) intoLevel / (next - Levels.threshold(level))));
        return new XpSnapshot(totalXp, level, progress, intoLevel, toNext, Math.max(0L, kills));
    }

    public static void put(UUID playerId, XpSnapshot snapshot) {
        ONLINE.put(playerId, snapshot);
    }

    public static XpSnapshot get(UUID playerId) {
        return ONLINE.get(playerId);
    }

    public static void remove(UUID playerId) {
        ONLINE.remove(playerId);
    }
}
