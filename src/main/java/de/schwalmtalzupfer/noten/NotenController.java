package de.schwalmtalzupfer.noten;

import de.schwalmtalzupfer.storage.R2Service;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/noten")
@PreAuthorize("hasAnyRole('GUEST', 'MEMBER', 'BOARD', 'ADMIN')")
@RequiredArgsConstructor
public class NotenController {

    private final S3Client s3Client;
    private final R2Service r2Service;

    @Value("${app.r2.bucket}")
    private String bucket;

    /**
     * Listet alle Noten-Dateien unterhalb des angegebenen Präfixes (rekursiv, kein Delimiter).
     * Gibt eine flache Liste zurück – ideal für Suche/Anzeige aller Noten.
     */
    @GetMapping("/list")
    public List<Map<String, Object>> list(@RequestParam(defaultValue = "") String prefix) {
        ListObjectsV2Request req = ListObjectsV2Request.builder()
                .bucket(bucket)
                .prefix(prefix)
                .build();

        return s3Client.listObjectsV2Paginator(req).contents().stream()
                .filter(obj -> !obj.key().endsWith("/")) // Ordner-Platzhalter überspringen
                .map(obj -> Map.<String, Object>of(
                        "key", obj.key(),
                        "name", obj.key().contains("/") ? obj.key().substring(obj.key().lastIndexOf('/') + 1) : obj.key(),
                        "size", obj.size(),
                        "lastModified", obj.lastModified().toString()
                ))
                .toList();
    }

    /**
     * Listet Ordner und Dateien direkt unterhalb des Präfixes (mit Delimiter).
     */
    @GetMapping("/browse")
    public Map<String, Object> browse(@RequestParam(defaultValue = "") String prefix) {
        ListObjectsV2Request req = ListObjectsV2Request.builder()
                .bucket(bucket)
                .prefix(prefix)
                .delimiter("/")
                .build();
        ListObjectsV2Response result = s3Client.listObjectsV2(req);

        List<String> folders = result.commonPrefixes().stream()
                .map(CommonPrefix::prefix)
                .toList();
        List<String> files = result.contents().stream()
                .map(S3Object::key)
                .filter(k -> !k.equals(prefix))
                .toList();

        return Map.of("folders", folders, "files", files, "prefix", prefix);
    }

    /**
     * Liefert eine einzelne Note zur Inline-Vorschau (PDF, Audio, Bild).
     */
    @GetMapping("/preview")
    public void previewSingle(@RequestParam String key, HttpServletResponse response) throws IOException {
        try {
            GetObjectRequest req = GetObjectRequest.builder().bucket(bucket).key(key).build();
            ResponseInputStream<GetObjectResponse> obj = s3Client.getObject(req);
            GetObjectResponse meta = obj.response();

            String filename = key.contains("/") ? key.substring(key.lastIndexOf('/') + 1) : key;
            String contentType = meta.contentType() != null && !meta.contentType().isBlank()
                    ? meta.contentType() : guessMimeType(key);

            String encodedName = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");
            response.setContentType(contentType);
            response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "inline; filename*=UTF-8''" + encodedName);
            if (meta.contentLength() != null) response.setContentLengthLong(meta.contentLength());

            byte[] buf = new byte[8192];
            int read;
            try (var out = response.getOutputStream()) {
                while ((read = obj.read(buf)) != -1) out.write(buf, 0, read);
            }
        } catch (NoSuchKeyException e) {
            response.setStatus(404);
        }
    }

    private String guessMimeType(String key) {
        String lower = key.toLowerCase();
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".ogg")) return "audio/ogg";
        if (lower.endsWith(".flac")) return "audio/flac";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        return "application/octet-stream";
    }

    /**
     * Lädt eine einzelne Note direkt herunter (proxied vom R2).
     */
    @GetMapping("/download")
    public void downloadSingle(@RequestParam String key, HttpServletResponse response) throws IOException {
        try {
            GetObjectRequest req = GetObjectRequest.builder().bucket(bucket).key(key).build();
            ResponseInputStream<GetObjectResponse> obj = s3Client.getObject(req);
            GetObjectResponse meta = obj.response();

            String filename = key.contains("/") ? key.substring(key.lastIndexOf('/') + 1) : key;
            String encodedName = URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");

            response.setContentType(meta.contentType() != null ? meta.contentType() : "application/octet-stream");
            response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedName);
            if (meta.contentLength() != null) response.setContentLengthLong(meta.contentLength());

            byte[] buf = new byte[8192];
            int read;
            try (var out = response.getOutputStream()) {
                while ((read = obj.read(buf)) != -1) out.write(buf, 0, read);
            }
        } catch (NoSuchKeyException e) {
            response.setStatus(404);
        }
    }

    /**
     * Lädt ausgewählte Noten als ZIP herunter.
     * Body: { "keys": ["Noten/datei1.pdf", ...] }
     */
    @PostMapping("/download/zip")
    public void downloadZip(@RequestBody KeysRequest request, HttpServletResponse response) throws IOException {
        response.setContentType("application/zip");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"Noten.zip\"");
        r2Service.downloadKeysAsZip(request.keys(), response.getOutputStream());
    }

    /**
     * Lädt alle Noten unterhalb eines Präfixes als ZIP herunter.
     */
    @GetMapping("/download/all")
    public void downloadAll(@RequestParam(defaultValue = "") String prefix, HttpServletResponse response) throws IOException {
        List<String> keys = s3Client.listObjectsV2Paginator(
                ListObjectsV2Request.builder().bucket(bucket).prefix(prefix).build()
        ).contents().stream()
                .map(S3Object::key)
                .filter(k -> !k.endsWith("/"))
                .toList();

        response.setContentType("application/zip");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"Alle_Noten.zip\"");
        r2Service.downloadKeysAsZip(keys, response.getOutputStream());
    }

    /**
     * Lädt eine oder mehrere Noten hoch (nur BOARD / ADMIN).
     * Dateien, deren Name bereits im Bucket existiert, werden übersprungen.
     * Body: multipart/form-data mit Feld "files" (mehrere Dateien erlaubt) und
     *       optionalem Feld "prefix" (Standard: der konfigurierte Noten-Prefix).
     */
    @PostMapping("/upload")
    @PreAuthorize("hasAnyRole('BOARD', 'CHEF', 'ADMIN')")
    public ResponseEntity<Map<String, Object>> upload(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam(defaultValue = "") String prefix
    ) throws IOException {

        // Existierende Dateinamen ermitteln
        Set<String> existingNames = s3Client.listObjectsV2Paginator(
                ListObjectsV2Request.builder().bucket(bucket).prefix(prefix).build()
        ).contents().stream()
                .filter(obj -> !obj.key().endsWith("/"))
                .map(obj -> obj.key().contains("/")
                        ? obj.key().substring(obj.key().lastIndexOf('/') + 1)
                        : obj.key())
                .collect(Collectors.toSet());

        List<String> added = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (MultipartFile file : files) {
            String original = file.getOriginalFilename();
            if (original == null || original.isBlank()) continue;

            // Pfadtrennzeichen entfernen (Windows / Browser können Pfade liefern)
            String filename = original;
            if (filename.contains("/"))  filename = filename.substring(filename.lastIndexOf('/') + 1);
            if (filename.contains("\\")) filename = filename.substring(filename.lastIndexOf('\\') + 1);

            if (existingNames.contains(filename)) {
                skipped.add(filename);
                continue;
            }

            try {
                String key = prefix.isBlank() ? filename
                        : (prefix.endsWith("/") ? prefix + filename : prefix + "/" + filename);
                String ct = file.getContentType() != null && !file.getContentType().isBlank()
                        ? file.getContentType() : guessMimeType(filename);
                r2Service.upload(bucket, key, file.getInputStream(), ct, file.getSize());
                added.add(filename);
                existingNames.add(filename); // Doppelungen innerhalb desselben Uploads verhindern
            } catch (Exception e) {
                errors.add(filename);
            }
        }

        return ResponseEntity.ok(Map.of(
                "total",        files.size(),
                "added",        added.size(),
                "skipped",      skipped.size(),
                "errors",       errors.size(),
                "addedFiles",   added,
                "skippedFiles", skipped,
                "errorFiles",   errors
        ));
    }

    public record KeysRequest(List<String> keys) {}
}



