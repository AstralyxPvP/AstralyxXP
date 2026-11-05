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
        return getDetailed(path).thenApply(response ->
                response.isSuccessful() ? Optional.of(response.body()) : Optional.empty());
    }

    public CompletableFuture<Optional<String>> post(String path, String jsonBody) {
        return sendDetailed("POST", path, jsonBody).thenApply(response ->
                response.isSuccessful() ? Optional.of(response.body()) : Optional.empty());
    }

    public CompletableFuture<ApiResponse> getDetailed(String path) {
        return sendDetailed("GET", path, null);
    }

    private CompletableFuture<ApiResponse> sendDetailed(String method, String path, String jsonBody) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                HttpRequest.Builder b = HttpRequest.newBuilder()
                        .uri(URI.create(baseUrl + path))
                        .header("Authorization", "Bearer " + secret)
                        .header("User-Agent", "AstralyxXP-Paper/1.0")
                        .method(method, jsonBody == null
                                ? HttpRequest.BodyPublishers.noBody()
                                : HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8));
                if (jsonBody != null) {
                    b.header("Content-Type", "application/json");
                }
                HttpResponse<InputStream> response = http.send(
                        b.build(), HttpResponse.BodyHandlers.ofInputStream());
                try (InputStream in = response.body()) {
                    String body = new String(in.readAllBytes(), StandardCharsets.UTF_8);
                    return new ApiResponse(response.statusCode(), body, null);
                }
            } catch (Exception e) {
                String detail = e.getMessage();
                return new ApiResponse(-1, "", e.getClass().getSimpleName()
                        + (detail == null || detail.isBlank() ? "" : ": " + detail));
            }
        });
    }

    public record ApiResponse(int statusCode, String body, String error) {
        public boolean isSuccessful() {
            return statusCode >= 200 && statusCode < 300;
        }
    }
}