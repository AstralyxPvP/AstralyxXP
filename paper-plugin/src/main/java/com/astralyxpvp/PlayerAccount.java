package com.astralyxpvp;

/** A player's resolved state: which mode they're in plus their Discord ID. */
public final class PlayerAccount {

    public final Mode mode;
    public final String discordId;

    public PlayerAccount(Mode mode, String discordId) {
        this.mode = mode;
        this.discordId = discordId;
    }
}