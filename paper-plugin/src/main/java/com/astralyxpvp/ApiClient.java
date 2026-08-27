package com.astralyxpvp;

import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

/**
 * Talks to the AstralyxPvP worker API.
 *
 * All responses are JSON like:
 *   {"discord_id":"...","xp":120,"level":3,"next_level_xp":200,"progress":42}
 */
public final class ApiClient {

    private final String baseUrl;
    private final String secret;
    private final HttpClient http;

    public ApiClient(String baseUrl, String secret) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.secret = secret;
        this.http = HttpClient.newBuilder()
                .connectTimeout(java.time.Duration.ofSeconds(5))
                .build();
    }

    public CompletableFuture<Optional<String>> get(String path) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create(baseUrl + path))
                        .header("Authorization", "Bearer " + secret)
                        .header("User-Agent", "AstralyxXP-Paper/1.0")
                        .GET()
                        .build();
                HttpResponse<InputStream> res = http.send(req, HttpResponse.BodyHandlers.ofInputStream());
                if (res.statusCode() >= 400) {
                    return Optional.empty();
                }
                try (InputStream in = res.body()) {
                    String body = new String(in.readAllBytes(), StandardCharsets.UTF_8);
                    return Optional.of(body);
                }
            } catch (Exception e) {
                return Optional.empty();
            }
        });
    }
}