package com.astralyxpvp;

/** Where a player's XP balance lives. */
public enum Mode {
    /** Linked to a Discord account — XP lives in the worker and syncs. */
    LINKED,
    /** Playing unlinked — XP lives locally in players.yml and never syncs. */
    UNLINKED,
    /** Never chose (greeting still pending). */
    PENDING,
    /** Linking service unreachable. */
    OFFLINE
}