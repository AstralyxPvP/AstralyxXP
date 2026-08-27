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