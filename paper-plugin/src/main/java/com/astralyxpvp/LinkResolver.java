package com.astralyxpvp;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

/**
 * Resolves whether a Minecraft username is linked to a Discord account by
 * asking the link worker's KV source of truth (?checkLink=).
 */
public final class LinkResolver {

    private final ApiClient linkApi;

    public LinkResolver(ApiClient linkApi) {
        this.linkApi = linkApi;
    }

    /**
     * Returns the linked Discord ID for a username, or empty if the player is
     * not linked (or the linking service is unreachable).
     */
    public CompletableFuture<Optional<String>> discordIdFor(String username) {
        String path = "/?checkLink=" + URLEncoder.encode(username, StandardCharsets.UTF_8);
        return linkApi.get(path).thenApply(body -> body.flatMap(json -> {
            String id = Json.string(json, "discordId");
            return id == null ? Optional.empty() : Optional.of(id);
        }));
    }
}