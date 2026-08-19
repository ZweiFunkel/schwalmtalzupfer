package de.schwalmtalzupfer.galerie;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.util.*;

@RestController
@RequestMapping("/api/galerie")
@RequiredArgsConstructor
public class GalerieController {

    private final S3Client s3Client;
    private final ThumbnailService thumbnailService;

    @Value("${app.r2.bucket}")
    private String bucket;

    @Value("${app.r2.public-url:}")
    private String publicUrl;

    @Value("${app.invitation.base-url:http://localhost:8080}")
    private String appBaseUrl;

    private static final Set<String> IMAGE_EXTS = Set.of(".jpg", ".jpeg", ".png", ".webp", ".gif");

    /**
     * Listet den Inhalt eines Galerie-Pfads (Unterordner + direkte Bilder).
     * Für jeden Unterordner werden rekursiv Gesamtbildanzahl und ein Vorschaubild ermittelt.
     */
    @GetMapping("/browse")
    public Map<String, Object> browse(@RequestParam(name = "prefix", defaultValue = "galerie/") String prefixParam) {
        final String prefix = prefixParam.endsWith("/") ? prefixParam : prefixParam + "/";
        try {
            // Direkte Kinder (mit Delimiter)
            ListObjectsV2Response direct = s3Client.listObjectsV2(
                    ListObjectsV2Request.builder().bucket(bucket).prefix(prefix).delimiter("/").build());

            List<Map<String, Object>> folders = new ArrayList<>();
            for (CommonPrefix cp : direct.commonPrefixes()) {
                String folderPrefix = cp.prefix();
                String folderName = folderPrefix.substring(prefix.length(), folderPrefix.length() - 1);

                // Alle Bilder im Unterordner zählen (rekursiv, paginiert) + Cover ermitteln
                List<String> imageKeys = listAllImageKeys(folderPrefix);

                // Hat dieser Ordner selbst Unterordner?
                boolean hasSubFolders = !s3Client.listObjectsV2(
                        ListObjectsV2Request.builder().bucket(bucket)
                                .prefix(folderPrefix).delimiter("/").maxKeys(1).build()
                ).commonPrefixes().isEmpty();

                Map<String, Object> folder = new HashMap<>();
                folder.put("name", folderName);
                folder.put("prefix", folderPrefix);
                folder.put("coverUrl", imageKeys.isEmpty() ? "" : buildPublicUrl(imageKeys.get(0)));
                folder.put("imageCount", imageKeys.size());
                folder.put("hasSubFolders", hasSubFolders);
                folders.add(folder);
            }

            // Ordner nach Namen absteigend sortieren (neueste zuerst, z.B. 2024 vor 2022)
            folders.sort((a, b) -> {
                String nameA = (String) a.get("name");
                String nameB = (String) b.get("name");
                return nameB.compareTo(nameA);
            });

            // Direkte Bilddateien auf diesem Level - absteigend nach Key
            List<Map<String, Object>> images = direct.contents().stream()
                    .filter(obj -> !obj.key().equals(prefix) && isImage(obj.key()))
                    .sorted(Comparator.comparing(S3Object::key).reversed())
                    .map(obj -> {
                        Map<String, Object> m = new HashMap<>();
                        m.put("key", obj.key());
                        m.put("url", buildPublicUrl(obj.key()));
                        m.put("name", getFileName(obj.key()));
                        return m;
                    })
                    .toList();

            // Thumbnails für alle direkten Bilder im Hintergrund vorwärmen
            if (!images.isEmpty()) {
                List<String> keys = images.stream().map(m -> (String) m.get("key")).toList();
                thumbnailService.warmAsync(keys);
            }

            Map<String, Object> result = new HashMap<>();
            result.put("prefix", prefix);
            result.put("folders", folders);
            result.put("images", images);
            return result;
        } catch (Exception e) {
            System.err.println("ERROR in galerie browse for prefix '" + prefix + "': " + e.getMessage());
            // Leeres Ergebnis zurückgeben statt 500 – Frontend zeigt "Keine Inhalte" an
            Map<String, Object> empty = new HashMap<>();
            empty.put("prefix", prefix);
            empty.put("folders", Collections.emptyList());
            empty.put("images", Collections.emptyList());
            return empty;
        }
    }

    /**
     * Gibt alle Alben (Blatt-Ordner mit Bildern) als flache Liste zurück.
     * Ein einzelner S3-Call für alle Keys – daraus wird die Struktur abgeleitet.
     */
    @GetMapping("/albums")
    public List<Map<String, Object>> listAllAlbums() {
        List<String> allKeys = listAllImageKeys("galerie/");

        // Keys nach direktem Eltern-Ordner gruppieren
        Map<String, List<String>> byFolder = new LinkedHashMap<>();
        for (String key : allKeys) {
            int lastSlash = key.lastIndexOf('/');
            if (lastSlash <= 0) continue;
            String folder = key.substring(0, lastSlash + 1);
            if (folder.equals("galerie/")) continue;
            byFolder.computeIfAbsent(folder, k -> new ArrayList<>()).add(key);
        }

        List<Map<String, Object>> albums = new ArrayList<>();
        for (var entry : byFolder.entrySet()) {
            String fp    = entry.getKey();   // z.B. "galerie/ausfluege/allgaeu/2013/"
            List<String> imgs = entry.getValue();

            // Pfad-Teile ohne "galerie/" Prefix
            String withoutRoot = fp.substring("galerie/".length()); // "ausfluege/allgaeu/2013/"
            String[] parts = withoutRoot.split("/");
            // parts = ["ausfluege","allgaeu","2013",""]
            // name      = vorletztes Element  → "2013"
            // breadcrumb = alle davor          → ["ausfluege","allgaeu"]
            String name = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
            List<String> breadcrumb = new ArrayList<>();
            for (int i = 0; i < parts.length - 2; i++) {
                if (!parts[i].isEmpty()) breadcrumb.add(parts[i]);
            }

            Map<String, Object> album = new HashMap<>();
            album.put("prefix",     fp);
            album.put("name",       name);
            album.put("breadcrumb", breadcrumb);
            album.put("coverUrl",   buildPublicUrl(imgs.get(0)));
            album.put("imageCount", imgs.size());
            albums.add(album);
        }
        
        // Alben absteigend nach Name sortieren (neueste zuerst, z.B. 2024 vor 2022)
        albums.sort((a, b) -> {
            String nameA = (String) a.get("name");
            String nameB = (String) b.get("name");
            return nameB.compareTo(nameA);
        });
        
        return albums;
    }

    /** Listet alle Bild-Keys unterhalb eines Prefixes (paginiert, rekursiv). */
    private List<String> listAllImageKeys(String prefix) {
        List<String> keys = new ArrayList<>();
        String token = null;
        do {
            ListObjectsV2Request.Builder b = ListObjectsV2Request.builder().bucket(bucket).prefix(prefix);
            if (token != null) b.continuationToken(token);
            ListObjectsV2Response resp = s3Client.listObjectsV2(b.build());
            resp.contents().stream().map(S3Object::key).filter(this::isImage).sorted().forEach(keys::add);
            token = resp.isTruncated() ? resp.nextContinuationToken() : null;
        } while (token != null);
        // Absteigende Sortierung (neueste zuerst, z.B. 2024 vor 2022)
        keys.sort(Comparator.reverseOrder());
        return keys;
    }

    private boolean isImage(String key) {
        String lower = key.toLowerCase();
        return IMAGE_EXTS.stream().anyMatch(lower::endsWith);
    }

    private String getFileName(String key) {
        return key.contains("/") ? key.substring(key.lastIndexOf('/') + 1) : key;
    }

    private String buildPublicUrl(String key) {
        if (publicUrl != null && !publicUrl.isBlank()) {
            return publicUrl.stripTrailing() + "/" + key;
        }
        // Absolut statt eines bloß relativen "/r2/..."-Pfads - siehe AdminController.buildPublicUrl
        // für die ausführliche Begründung (Mobile-App hat keinen impliziten Ursprung).
        return appBaseUrl.stripTrailing() + "/r2/" + key;
    }
}

