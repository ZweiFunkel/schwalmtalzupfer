package de.schwalmtalzupfer.page;

import java.util.*;

/** Copies CMS content without private event notes, including translation entries. */
public final class PublicPageContent {
    private PublicPageContent() {}
    public static Map<String, Object> sanitize(Map<String, Object> content) {
        Set<String> privateTexts = new HashSet<>();
        collect(content, privateTexts);
        return (Map<String, Object>) copy(content, privateTexts);
    }
    private static void collect(Object value, Set<String> texts) {
        if (value instanceof Map<?, ?> map) map.forEach((key, item) -> {
            if ("internalNotes".equals(key) && item instanceof String text) texts.add(text);
            else collect(item, texts);
        });
        else if (value instanceof List<?> list) list.forEach(item -> collect(item, texts));
    }
    private static Object copy(Object value, Set<String> privateTexts) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> result = new LinkedHashMap<>();
            map.forEach((key, item) -> {
                if (!"internalNotes".equals(key) && !privateTexts.contains(key)) result.put((String) key, copy(item, privateTexts));
            });
            return result;
        }
        if (value instanceof List<?> list) return list.stream().map(item -> copy(item, privateTexts)).toList();
        return value;
    }
}
