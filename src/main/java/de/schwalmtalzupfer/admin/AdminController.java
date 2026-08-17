package de.schwalmtalzupfer.admin;

import de.schwalmtalzupfer.config.SiteSettings;
import de.schwalmtalzupfer.config.SiteSettingsRepository;
import de.schwalmtalzupfer.storage.R2Service;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CommonPrefix;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.S3Object;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminController {

    private final R2Service r2Service;
    private final S3Client s3Client;
    private final SiteSettingsRepository siteSettingsRepository;

    @Value("${app.r2.bucket}")
    private String bucket;

    @Value("${app.r2.public-url:}")
    private String publicUrl;

    /** Listet Assets im R2-Bucket mit Ordnerstruktur (delimiter=/).
     *  Mit recursive=true werden alle Dateien tief unterhalb des Prefixes zurückgegeben (kein Delimiter). */
    @GetMapping("/assets")
    public Map<String, Object> listAssets(
            @RequestParam(defaultValue = "") String prefix,
            @RequestParam(defaultValue = "false") boolean recursive) {

        if (recursive) {
            // Rekursive Auflistung aller Dateien (paginiert, ohne Delimiter)
            List<Map<String, Object>> allFiles = new ArrayList<>();
            String token = null;
            do {
                ListObjectsV2Request.Builder b = ListObjectsV2Request.builder().bucket(bucket).prefix(prefix);
                if (token != null) b.continuationToken(token);
                ListObjectsV2Response resp = s3Client.listObjectsV2(b.build());
                resp.contents().stream()
                        .filter(obj -> !obj.key().equals(prefix) && !obj.key().endsWith("/"))
                        .map(obj -> Map.<String, Object>of(
                                "key", obj.key(),
                                "size", obj.size(),
                                "lastModified", obj.lastModified().toString(),
                                "url", buildPublicUrl(obj.key())))
                        .forEach(allFiles::add);
                token = resp.isTruncated() ? resp.nextContinuationToken() : null;
            } while (token != null);
            return Map.of("folders", List.of(), "files", allFiles, "prefix", prefix);
        }

        ListObjectsV2Request req = ListObjectsV2Request.builder()
                .bucket(bucket)
                .prefix(prefix)
                .delimiter("/")
                .build();
        ListObjectsV2Response result = s3Client.listObjectsV2(req);

        List<String> folders = result.commonPrefixes().stream()
                .map(CommonPrefix::prefix)
                .toList();

        List<Map<String, Object>> files = result.contents().stream()
                // skip "folder" placeholder objects (key == prefix or key ends with /)
                .filter(obj -> !obj.key().equals(prefix) && !obj.key().endsWith("/"))
                .map(obj -> Map.<String, Object>of(
                        "key", obj.key(),
                        "size", obj.size(),
                        "lastModified", obj.lastModified().toString(),
                        "url", buildPublicUrl(obj.key())
                ))
                .toList();

        return Map.of("folders", folders, "files", files, "prefix", prefix);
    }

    /** Lädt eine Datei in den R2-Bucket hoch */
    @PostMapping(value = "/assets/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folder", defaultValue = "images") String folder) throws IOException {
        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        String baseKey = folder + "/" + originalFilename;
        String key = generateUniqueKey(baseKey, folder, originalFilename);

        r2Service.upload(bucket, key, file.getInputStream(),
                file.getContentType() != null ? file.getContentType() : "application/octet-stream",
                file.getSize());
        return ResponseEntity.ok(Map.of(
                "key", key,
                "url", buildPublicUrl(key)
        ));
    }

    /** Generiert einen eindeutigen Key: falls die Datei schon existiert, wird (1), (2) etc. vor der Extension eingefügt. */
    private String generateUniqueKey(String baseKey, String folder, String filename) {
        // Prüfe, ob die Datei bereits existiert
        try {
            s3Client.headObject(b -> b.bucket(bucket).key(baseKey));
        } catch (software.amazon.awssdk.services.s3.model.NoSuchKeyException e) {
            // Datei existiert nicht → Original-Key verwenden
            return baseKey;
        }

        // Datei existiert schon → Zähler anhängen
        String nameWithoutExt;
        String ext = "";
        int lastDot = filename.lastIndexOf('.');
        if (lastDot > 0) {
            nameWithoutExt = filename.substring(0, lastDot);
            ext = filename.substring(lastDot);
        } else {
            nameWithoutExt = filename;
        }

        int counter = 1;
        while (true) {
            String key = folder + "/" + nameWithoutExt + "(" + counter + ")" + ext;
            try {
                s3Client.headObject(b -> b.bucket(bucket).key(key));
                counter++;
            } catch (software.amazon.awssdk.services.s3.model.NoSuchKeyException e) {
                return key;
            }
        }
    }

    /** Löscht ein Asset aus dem R2-Bucket */
    @DeleteMapping("/assets")
    public ResponseEntity<Void> deleteAsset(@RequestParam String key) {
        s3Client.deleteObject(b -> b.bucket(bucket).key(key));
        return ResponseEntity.noContent().build();
    }

    /** Benennt/verschiebt eine Datei um (copy + delete) */
    @PostMapping("/assets/rename")
    public ResponseEntity<Map<String, String>> renameAsset(@RequestBody Map<String, String> body) {
        String oldKey = body.get("oldKey");
        String newKey = body.get("newKey");
        if (oldKey == null || newKey == null || oldKey.isBlank() || newKey.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        if (oldKey.equals(newKey)) {
            return ResponseEntity.ok(Map.of("key", newKey, "url", buildPublicUrl(newKey)));
        }
        try {
            s3Client.copyObject(CopyObjectRequest.builder()
                    .sourceBucket(bucket).sourceKey(oldKey)
                    .destinationBucket(bucket).destinationKey(newKey)
                    .build());
            s3Client.deleteObject(b -> b.bucket(bucket).key(oldKey));
            return ResponseEntity.ok(Map.of("key", newKey, "url", buildPublicUrl(newKey)));
        } catch (software.amazon.awssdk.services.s3.model.NoSuchKeyException e) {
            return ResponseEntity.status(404).body(Map.of("error", "Quelldatei nicht gefunden: " + oldKey));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage() != null ? e.getMessage() : "Unbekannter Fehler"));
        }
    }

    /** Erstellt einen leeren Ordner (Placeholder-Objekt mit key ending '/') */
    @PostMapping("/assets/folder")
    public ResponseEntity<Map<String, String>> createFolder(@RequestBody Map<String, String> body) {
        String folderKey = body.get("key");
        if (folderKey == null || folderKey.isBlank()) return ResponseEntity.badRequest().build();
        if (!folderKey.endsWith("/")) folderKey = folderKey + "/";
        s3Client.putObject(
                software.amazon.awssdk.services.s3.model.PutObjectRequest.builder()
                        .bucket(bucket).key(folderKey).contentLength(0L).contentType("application/x-directory").build(),
                software.amazon.awssdk.core.sync.RequestBody.empty());
        return ResponseEntity.ok(Map.of("key", folderKey));
    }

    /** Löscht einen Ordner (alle Objekte mit gegebenem Prefix) */
    @DeleteMapping("/assets/folder")
    public ResponseEntity<Map<String, Integer>> deleteFolder(@RequestParam String prefix) {
        if (!prefix.endsWith("/")) prefix = prefix + "/";
        List<String> toDelete = new ArrayList<>();
        String continuationToken = null;
        do {
            ListObjectsV2Request.Builder reqBuilder = ListObjectsV2Request.builder()
                    .bucket(bucket).prefix(prefix);
            if (continuationToken != null) reqBuilder.continuationToken(continuationToken);
            ListObjectsV2Response resp = s3Client.listObjectsV2(reqBuilder.build());
            resp.contents().stream().map(S3Object::key).forEach(toDelete::add);
            continuationToken = resp.isTruncated() ? resp.nextContinuationToken() : null;
        } while (continuationToken != null);

        for (String key : toDelete) {
            s3Client.deleteObject(b -> b.bucket(bucket).key(key));
        }
        return ResponseEntity.ok(Map.of("deleted", toDelete.size()));
    }

    /** Kopiert einen ganzen Ordner rekursiv an eine neue Position.
     *  Bei overwrite=false wird 409 mit einer Liste der Konflikte zurückgegeben. */
    @PostMapping("/assets/copy-folder")
    public ResponseEntity<Map<String, Object>> copyFolder(@RequestBody Map<String, Object> body) {
        String sourcePrefix = (String) body.get("sourcePrefix");
        String targetPrefix = (String) body.get("targetPrefix");
        boolean overwrite   = Boolean.TRUE.equals(body.get("overwrite"));

        if (sourcePrefix == null || targetPrefix == null) return ResponseEntity.badRequest().build();
        if (!sourcePrefix.endsWith("/")) sourcePrefix += "/";
        if (!targetPrefix.endsWith("/")) targetPrefix += "/";

        // Alle Quell-Objekte rekursiv auflisten
        List<String> allKeys = new ArrayList<>();
        String token = null;
        do {
            ListObjectsV2Request.Builder b = ListObjectsV2Request.builder().bucket(bucket).prefix(sourcePrefix);
            if (token != null) b.continuationToken(token);
            ListObjectsV2Response resp = s3Client.listObjectsV2(b.build());
            resp.contents().stream().map(S3Object::key).filter(k -> !k.endsWith("/")).forEach(allKeys::add);
            token = resp.isTruncated() ? resp.nextContinuationToken() : null;
        } while (token != null);

        // Konflikte prüfen (Ziel-Key existiert bereits)
        if (!overwrite) {
            List<String> conflicts = new ArrayList<>();
            for (String key : allKeys) {
                String newKey = targetPrefix + key.substring(sourcePrefix.length());
                try {
                    s3Client.headObject(b -> b.bucket(bucket).key(newKey));
                    conflicts.add(newKey);
                } catch (software.amazon.awssdk.services.s3.model.NoSuchKeyException ignored) {}
            }
            if (!conflicts.isEmpty()) {
                return ResponseEntity.status(409).body(Map.of("conflicts", conflicts));
            }
        }

        // Dateien kopieren
        final String sp = sourcePrefix;
        final String tp = targetPrefix;
        for (String key : allKeys) {
            String newKey = tp + key.substring(sp.length());
            s3Client.copyObject(CopyObjectRequest.builder()
                    .sourceBucket(bucket).sourceKey(key)
                    .destinationBucket(bucket).destinationKey(newKey)
                    .build());
        }

        return ResponseEntity.ok(Map.of("copied", allKeys.size(), "targetPrefix", tp));
    }

    /** Liefert alle Website-Einstellungen als Key-Value Map */
    @GetMapping("/settings")
    public Map<String, String> getSiteSettings() {
        Map<String, String> result = new HashMap<>();
        siteSettingsRepository.findAll().forEach(s -> {
            result.put(s.getSettingKey(), s.getSettingValue());
        });
        return result;
    }

    /** Aktualisiert eine Website-Einstellung */
    @PutMapping("/settings")
    public ResponseEntity<Void> updateSiteSettings(@RequestBody Map<String, String> settings) {
        for (Map.Entry<String, String> entry : settings.entrySet()) {
            SiteSettings siteSetting = siteSettingsRepository.findBySettingKey(entry.getKey())
                    .orElse(SiteSettings.builder()
                            .id(System.currentTimeMillis())
                            .settingKey(entry.getKey())
                            .build());
            siteSetting.setSettingValue(entry.getValue());
            siteSettingsRepository.save(siteSetting);
        }
        return ResponseEntity.ok().build();
    }

    private String buildPublicUrl(String key) {
        if (publicUrl != null && !publicUrl.isBlank()) {
            return publicUrl.stripTrailing() + "/" + key;
        }
        return "/r2/" + key; // handled by R2ProxyController
    }
}


