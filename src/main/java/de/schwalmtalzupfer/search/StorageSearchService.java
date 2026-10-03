package de.schwalmtalzupfer.search;

import de.schwalmtalzupfer.config.SiteSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

@Service
@RequiredArgsConstructor
public class StorageSearchService {
    private final S3Client s3;
    private final SiteSettingsRepository settings;
    @Value("${app.r2.bucket}") private String bucket;
    private final Map<String, Snapshot> cache = new HashMap<>();
    private record Snapshot(long expires, List<String> keys) {}
    public record Documents(List<SearchController.Result> results, List<String> unavailable) {}
    private String setting(String key) {
        return settings.findBySettingKey(key).map(s -> Objects.toString(s.getSettingValue(), "").strip()).orElse("");
    }
    private static String prefix(String value) { return value.isEmpty() || value.endsWith("/") ? value : value + "/"; }
    private synchronized List<String> keys(String root) {
        Snapshot hit = cache.get(root);
        if (hit != null && hit.expires > System.currentTimeMillis()) return hit.keys;
        List<String> result = s3.listObjectsV2Paginator(ListObjectsV2Request.builder().bucket(bucket).prefix(root)
            .overrideConfiguration(c -> c.apiCallTimeout(Duration.ofSeconds(8)).apiCallAttemptTimeout(Duration.ofSeconds(4))).build())
            .contents().stream().map(o -> o.key()).filter(k -> !k.endsWith("/")).toList();
        cache.entrySet().removeIf(e -> e.getValue().expires <= System.currentTimeMillis());
        cache.put(root, new Snapshot(System.currentTimeMillis() + 60000, result));
        return result;
    }
    private static String path(String value) {
        return Arrays.stream(value.split("/")).map(s -> URLEncoder.encode(s, StandardCharsets.UTF_8).replace("+", "%20")).reduce((a,b) -> a + "/" + b).orElse("");
    }
    public Documents documents(boolean signedIn, boolean notesAccess) {
        List<SearchController.Result> result = new ArrayList<>();
        List<String> unavailable = new ArrayList<>();
        String internalRoot = prefix(setting("galerie_intern_prefix"));
        gallery(result, unavailable, "galerie/", "galerie/", internalRoot, "Galerie");
        if (signedIn && !internalRoot.isBlank()) gallery(result, unavailable, internalRoot, "galerie-intern/", "", "Interne Galerie");
        if (notesAccess) {
            try {
                for (String key : keys(prefix(setting("noten_prefix")))) {
                    String name = key.substring(key.lastIndexOf('/') + 1);
                    result.add(new SearchController.Result(name, key.replace('/', ' '), "/api/noten/preview?key=" + URLEncoder.encode(key, StandardCharsets.UTF_8), "Noten"));
                }
            } catch (RuntimeException exception) { unavailable.add("Noten"); }
        }
        return new Documents(result, unavailable);
    }
    private void gallery(List<SearchController.Result> result, List<String> unavailable, String root, String route, String excludedRoot, String kind) {
        try {
            Set<String> folders = new LinkedHashSet<>();
            for (String key : keys(root)) {
                if (!excludedRoot.isBlank() && key.startsWith(excludedRoot)) continue;
                if (!key.toLowerCase(Locale.ROOT).matches(".*\\.(jpg|jpeg|png|webp|gif)$")) continue;
                String relative = key.substring(root.length());
                String parent = relative.contains("/") ? relative.substring(0, relative.lastIndexOf('/') + 1) : "";
                folders.add(parent);
                result.add(new SearchController.Result(relative.substring(relative.lastIndexOf('/') + 1), relative.replace('/', ' '), "/" + path(route + parent), kind));
            }
            for (String folder : folders) if (!folder.isEmpty()) result.add(new SearchController.Result(folder.replace('/', ' ').strip(), "", "/" + path(route + folder), kind));
        } catch (RuntimeException exception) { unavailable.add(kind); }
    }
}
