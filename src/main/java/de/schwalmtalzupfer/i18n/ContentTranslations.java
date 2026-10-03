package de.schwalmtalzupfer.i18n;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import java.io.IOException;
import java.util.*;

@Service
public class ContentTranslations {
    private final Map<String, String> english;
    public ContentTranslations() throws IOException {
        try (var stream = new ClassPathResource("i18n/cms-en.json").getInputStream()) {
            english = new ObjectMapper().readValue(stream, new TypeReference<Map<String,String>>() {});
        }
    }
    public void collect(Object value, Map<String,String> result) {
        if (value instanceof String text && english.containsKey(text)) result.put(text, english.get(text));
        else if (value instanceof Map<?,?> map) map.forEach((k,v) -> { if (!"_translations".equals(k)) collect(v, result); });
        else if (value instanceof Collection<?> list) list.forEach(v -> collect(v, result));
    }
    public String text(String value) { return english.getOrDefault(value, value); }
    public Map<String,String> forContent(Map<String,Object> content) {
        Map<String,String> result = new LinkedHashMap<>();
        collect(content, result);
        if (content.get("_translations") instanceof Map<?,?> locales && locales.get("en") instanceof Map<?,?> overrides) {
            Set<String> source = new HashSet<>();
            collectSources(content, source);
            overrides.forEach((k,v) -> { if (k instanceof String key && v instanceof String translated && source.contains(key) && !translated.isBlank()) result.put(key, translated); });
        }
        return result;
    }
    private void collectSources(Object value, Set<String> result) {
        if (value instanceof String text) result.add(text);
        else if (value instanceof Map<?,?> map) map.forEach((k,v) -> { if (!"_translations".equals(k)) collectSources(v, result); });
        else if (value instanceof Collection<?> list) list.forEach(v -> collectSources(v, result));
    }
}
