package com.astralyxpvp;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Minimal JSON field extractor (no external dependency).
 * Handles the flat objects the worker returns:
 *   {"key":"value","xp":120,"level":3}
 */
public final class Json {

    private static final Pattern STRING = Pattern.compile("\"([^\"]*)\"\\s*:\\s*\"([^\"]*)\"");
    private static final Pattern NUMBER = Pattern.compile("\"([^\"]*)\"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)");

    private Json() {
    }

    /** Returns the string value of {@code field}, or null if absent. */
    public static String string(String json, String field) {
        Matcher m = STRING.matcher(json);
        while (m.find()) {
            if (m.group(1).equals(field)) return m.group(2);
        }
        return null;
    }

    /** Returns the numeric value of {@code field}, or null if absent. */
    public static Long number(String json, String field) {
        Matcher m = NUMBER.matcher(json);
        while (m.find()) {
            if (m.group(1).equals(field)) return Long.parseLong(m.group(2));
        }
        return null;
    }

    /** Returns the int value of {@code field}, or 0 if absent. */
    public static int intValue(String json, String field) {
        Long v = number(json, field);
        return v == null ? 0 : v.intValue();
    }

    /** Escapes a string for embedding into a JSON object. */
    public static String escape(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    /** Builds a JSON key/value pair for a string. */
    public static String value(String field, String value) {
        return "\"" + field + "\":\"" + escape(value) + "\"";
    }

    /** Builds a JSON key/value pair for a number. */
    public static String value(String field, long value) {
        return "\"" + field + "\":" + value;
    }

    /**
     * Returns the first top-level string-array value of {@code field}, or an
     * empty list if absent. Elements must be plain (unescaped) strings.
     */
    public static java.util.List<String> strings(String json, String field) {
        java.util.List<String> out = new java.util.ArrayList<>();
        int idx = json.indexOf("\"" + field + "\"");
        if (idx < 0) return out;
        int start = json.indexOf('[', idx);
        if (start < 0) return out;
        int depth = 0;
        boolean inString = false;
        StringBuilder cur = new StringBuilder();
        for (int i = start; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '"' && (i == 0 || json.charAt(i - 1) != '\\')) {
                inString = !inString;
                if (inString) cur.setLength(0);
                continue;
            }
            if (!inString) {
                if (c == '[') depth++;
                else if (c == ']') {
                    depth--;
                    if (depth == 0) break;
                }
                continue;
            }
            cur.append(c);
        }
        // Re-scan to collect elements.
        out.clear();
        inString = false;
        cur.setLength(0);
        boolean inArray = false;
        for (int i = start; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '"' && (i == 0 || json.charAt(i - 1) != '\\')) {
                inString = !inString;
                if (!inString) {
                    out.add(cur.toString());
                    cur.setLength(0);
                }
                continue;
            }
            if (inString) {
                cur.append(c);
            } else if (c == '[' && !inArray) {
                inArray = true;
            } else if (c == ']' && inArray) {
                break;
            }
        }
        return out;
    }

    /**
     * Returns the top-level array value of {@code field} split into raw
     * element objects, or an empty list if absent.
     */
    public static java.util.List<String> objects(String json, String field) {
        java.util.List<String> out = new java.util.ArrayList<>();
        int idx = json.indexOf("\"" + field + "\"");
        if (idx < 0) return out;
        int start = json.indexOf('[', idx);
        if (start < 0) return out;

        int depth = 0;
        int elemStart = -1;
        boolean inString = false;
        for (int i = start; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '"' && (i == 0 || json.charAt(i - 1) != '\\')) inString = !inString;
            if (inString) continue;
            if (c == '{') {
                if (depth == 0) elemStart = i;
                depth++;
            } else if (c == '}') {
                depth--;
                if (depth == 0 && elemStart >= 0) {
                    out.add(json.substring(elemStart, i + 1));
                    elemStart = -1;
                }
            } else if (c == ']' && depth == 0) {
                break;
            }
        }
        return out;
    }
}