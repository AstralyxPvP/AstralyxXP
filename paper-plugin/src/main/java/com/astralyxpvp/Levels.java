package com.astralyxpvp;

/**
 * Mirrors the worker's level thresholds (levels 0-50).
 * Index = level, value = cumulative XP required.
 */
public final class Levels {

    private static final long[] THRESHOLDS = {
            0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500,
            5500, 6600, 7800, 9100, 10500, 12000, 13600, 15300, 17100, 19000,
            21000, 23100, 25300, 27600, 30000, 32500, 35100, 37800, 40600, 43500,
            46500, 49600, 52800, 56100, 59500, 63000, 66600, 70300, 74100, 78000,
            82000, 86100, 90300, 94600, 99000, 103500, 108100, 112800, 117600, 122500,
            127500,
    };

    public static final int MAX_LEVEL = THRESHOLDS.length - 1;

    private Levels() {
    }

    /** Returns the current level for a given XP amount. */
    public static int level(long xp) {
        for (int i = THRESHOLDS.length - 1; i >= 0; i--) {
            if (xp >= THRESHOLDS[i]) return i;
        }
        return 0;
    }

    /** Cumulative XP required to reach {@code level}, or 0 for level 0. */
    public static long threshold(int level) {
        if (level < 0) return 0;
        if (level >= THRESHOLDS.length) return THRESHOLDS[THRESHOLDS.length - 1];
        return THRESHOLDS[level];
    }

    /** XP required for the next level, or null at max level. */
    public static Long nextThreshold(int level) {
        if (level >= MAX_LEVEL) return null;
        return THRESHOLDS[level + 1];
    }

    /** Percent progress (0-100) into the current level. */
    public static int progress(long xp) {
        int level = level(xp);
        Long next = nextThreshold(level);
        if (next == null) return 100;
        long cur = threshold(level);
        long span = next - cur;
        if (span <= 0) return 100;
        return (int) Math.min(100L, ((xp - cur) * 100L) / span);
    }

    /** Returns the new level if an XP change crossed a threshold, else null. */
    public static Integer levelUp(long oldXp, long newXp) {
        int oldLevel = level(oldXp);
        int newLevel = level(newXp);
        return newLevel > oldLevel ? newLevel : null;
    }
}