package de.schwalmtalzupfer.noten;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.io.IOException;
import java.security.Principal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * PDF-Noten bearbeiten (Stift/Text) - nur Vorstand und Admin.
 *
 * <p>Jedes Speichern überschreibt die Note, legt aber vorher eine Sicherung der bisherigen Fassung unter
 * {@code _versions/<key>/<zeitstempel>.pdf} ab. Von dort lässt sich jede Version wiederherstellen (auch das
 * Wiederherstellen sichert zuerst den aktuellen Stand). Pro Datei werden die neuesten {@value #MAX_VERSIONS}
 * Versionen aufgehoben.
 */
@RestController
@RequestMapping("/api/noten")
@PreAuthorize("hasAnyRole('BOARD', 'ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class NotenEditController {

    public static final String VERSIONS_PREFIX = "_versions/";
    static final int MAX_VERSIONS = 30;
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss-SSS");

    private final S3Client s3Client;
    private final PdfAnnotationService annotationService;

    @Value("${app.r2.bucket}")
    private String bucket;

    public record AnnotateRequest(String key, List<PdfAnnotationService.Mark> marks) {}
    public record RestoreRequest(String key, String versionKey) {}

    @PostMapping("/annotate")
    public ResponseEntity<?> annotate(@RequestBody AnnotateRequest req, Principal principal) {
        String key = req.key();
        if (!isEditablePdfKey(key)) return error(400, "Nur PDF-Noten können bearbeitet werden.");
        if (req.marks() == null || req.marks().isEmpty()) return error(400, "Keine Änderungen zum Speichern.");

        byte[] original;
        try {
            original = s3Client.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(key).build()).asByteArray();
        } catch (NoSuchKeyException e) {
            return error(404, "Note nicht gefunden.");
        }

        byte[] edited;
        try {
            edited = annotationService.apply(original, req.marks());
        } catch (IllegalArgumentException e) {
            return error(400, e.getMessage());
        } catch (IOException | RuntimeException e) {
            log.warn("PDF-Bearbeitung fehlgeschlagen für {}: {}", key, e.getMessage());
            return error(422, "Die PDF konnte nicht bearbeitet werden.");
        }

        // Erst sichern, dann überschreiben: schlägt die Sicherung fehl, bleibt das Original unangetastet.
        String versionKey;
        try {
            versionKey = backup(key, principal == null ? "unbekannt" : principal.getName());
        } catch (RuntimeException e) {
            log.error("Sicherung vor dem Speichern fehlgeschlagen für {}: {}", key, e.getMessage());
            return error(500, "Sicherung der bisherigen Version fehlgeschlagen - nichts wurde geändert.");
        }

        s3Client.putObject(PutObjectRequest.builder().bucket(bucket).key(key)
                .contentType("application/pdf").contentLength((long) edited.length).build(),
                software.amazon.awssdk.core.sync.RequestBody.fromBytes(edited));
        pruneVersions(key);
        return ResponseEntity.ok(Map.of("saved", true, "version", versionKey, "size", edited.length));
    }

    @GetMapping("/versions")
    public ResponseEntity<?> versions(@RequestParam String key) {
        if (!isEditablePdfKey(key)) return error(400, "Ungültige Note.");
        List<Map<String, Object>> out = new ArrayList<>();
        for (S3Object o : listVersions(key)) {
            Map<String, Object> v = new LinkedHashMap<>();
            v.put("versionKey", o.key());
            v.put("savedAt", o.lastModified().toString());
            v.put("size", o.size());
            try {
                HeadObjectResponse head = s3Client.headObject(HeadObjectRequest.builder().bucket(bucket).key(o.key()).build());
                v.put("savedBy", head.metadata().getOrDefault("saved-by", ""));
            } catch (RuntimeException e) {
                v.put("savedBy", "");
            }
            out.add(v);
        }
        return ResponseEntity.ok(out);
    }

    @PostMapping("/restore")
    public ResponseEntity<?> restore(@RequestBody RestoreRequest req, Principal principal) {
        String key = req.key();
        String versionKey = req.versionKey();
        if (!isEditablePdfKey(key)) return error(400, "Ungültige Note.");
        if (versionKey == null || !versionKey.startsWith(VERSIONS_PREFIX + key + "/") || versionKey.contains("..")) {
            return error(400, "Ungültige Version.");
        }
        try {
            s3Client.headObject(HeadObjectRequest.builder().bucket(bucket).key(versionKey).build());
        } catch (NoSuchKeyException e) {
            return error(404, "Version nicht gefunden.");
        }

        String who = principal == null ? "unbekannt" : principal.getName();
        // Aktuellen Stand sichern, damit auch das Zurücksetzen selbst nicht destruktiv ist.
        try {
            backup(key, who + " (vor Wiederherstellung)");
        } catch (NoSuchKeyException ignored) {
            // Original existiert nicht mehr - Wiederherstellen legt es neu an
        } catch (RuntimeException e) {
            return error(500, "Sicherung des aktuellen Stands fehlgeschlagen - nichts wurde geändert.");
        }
        s3Client.copyObject(CopyObjectRequest.builder()
                .sourceBucket(bucket).sourceKey(versionKey)
                .destinationBucket(bucket).destinationKey(key)
                .contentType("application/pdf")
                .metadataDirective(MetadataDirective.REPLACE)
                .build());
        pruneVersions(key);
        return ResponseEntity.ok(Map.of("restored", true));
    }

    // ── Helfer ──────────────────────────────────────────────────────────────

    private String backup(String key, String savedBy) {
        String versionKey = VERSIONS_PREFIX + key + "/"
                + LocalDateTime.now(ZoneId.of("Europe/Berlin")).format(STAMP) + ".pdf";
        s3Client.copyObject(CopyObjectRequest.builder()
                .sourceBucket(bucket).sourceKey(key)
                .destinationBucket(bucket).destinationKey(versionKey)
                .contentType("application/pdf")
                .metadataDirective(MetadataDirective.REPLACE)
                .metadata(Map.of("saved-by", asciiOnly(savedBy)))
                .build());
        return versionKey;
    }

    private List<S3Object> listVersions(String key) {
        List<S3Object> all = new ArrayList<>(s3Client.listObjectsV2Paginator(ListObjectsV2Request.builder()
                .bucket(bucket).prefix(VERSIONS_PREFIX + key + "/").build()).contents().stream().toList());
        all.sort(Comparator.comparing(S3Object::key).reversed()); // Zeitstempel im Namen: neueste zuerst
        return all;
    }

    private void pruneVersions(String key) {
        List<S3Object> all = listVersions(key);
        for (int i = MAX_VERSIONS; i < all.size(); i++) {
            s3Client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(all.get(i).key()).build());
        }
    }

    /** S3-Metadaten dürfen nur ASCII enthalten. */
    private static String asciiOnly(String s) {
        return s.replaceAll("[^\\x20-\\x7E]", "?");
    }

    static boolean isEditablePdfKey(String key) {
        return key != null && key.toLowerCase().endsWith(".pdf")
                && !key.startsWith(VERSIONS_PREFIX) && !key.contains("..") && !key.startsWith("/");
    }

    private static ResponseEntity<Map<String, String>> error(int status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }
}
