package de.schwalmtalzupfer.galerie;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.io.IOException;
import java.util.*;

/**
 * Interne Galerie (nur für angemeldete Mitglieder/Gäste, siehe SecurityConfig) - fachlich
 * dasselbe wie {@link GalerieController}, aber unter einem eigenen R2-Prefix ("galerie-intern/")
 * und nicht öffentlich erreichbar. Bewusst als eigener Controller statt Parametrisierung des
 * öffentlichen GalerieController, um die Auth-Grenze nicht von einem Request-Parameter abhängig
 * zu machen.
 *
 * WICHTIG: Anders als beim öffentlichen GalerieController werden Bild-URLs NICHT über die
 * öffentliche R2-Public-URL oder den unauthentifizierten "/r2/"-Proxy ausgeliefert (der jeden
 * Key ungeprüft durchlässt) - sonst wäre die "interne" Galerie trotzdem für jeden ohne Login
 * direkt per URL abrufbar. Stattdessen werden Vorschau UND Vollbild über eigene, durch
 * SecurityConfig geschützte Endpunkte gestreamt (siehe /thumbnail und /image).
 */
@RestController
@RequestMapping("/api/galerie-intern")
@RequiredArgsConstructor
public class GalerieInternController {

    private static final String ROOT = "galerie-intern/";

    private final S3Client s3Client;
    private final ThumbnailService thumbnailService;

    @Value("${app.r2.bucket}")
    private String bucket;

    private static final Set<String> IMAGE_EXTS = Set.of(".jpg", ".jpeg", ".png", ".webp", ".gif");

    @GetMapping("/browse")
    public Map<String, Object> browse(@RequestParam(name = "prefix", defaultValue = ROOT) String prefixParam) {
        final String prefix = prefixParam.endsWith("/") ? prefixParam : prefixParam + "/";
        try {
            ListObjectsV2Response direct = s3Client.listObjectsV2(
                    ListObjectsV2Request.builder().bucket(bucket).prefix(prefix).delimiter("/").build());

            List<Map<String, Object>> folders = new ArrayList<>();
            for (CommonPrefix cp : direct.commonPrefixes()) {
                String folderPrefix = cp.prefix();
                String folderName = folderPrefix.substring(prefix.length(), folderPrefix.length() - 1);

                List<String> imageKeys = listAllImageKeys(folderPrefix);

                boolean hasSubFolders = !s3Client.listObjectsV2(
                        ListObjectsV2Request.builder().bucket(bucket)
                                .prefix(folderPrefix).delimiter("/").maxKeys(1).build()
                ).commonPrefixes().isEmpty();

                Map<String, Object> folder = new HashMap<>();
                folder.put("name", folderName);
                folder.put("prefix", folderPrefix);
                folder.put("coverUrl", imageKeys.isEmpty() ? "" : buildImageUrl(imageKeys.get(0)));
                folder.put("imageCount", imageKeys.size());
                folder.put("hasSubFolders", hasSubFolders);
                folders.add(folder);
            }

            folders.sort((a, b) -> ((String) b.get("name")).compareTo((String) a.get("name")));

            List<Map<String, Object>> images = direct.contents().stream()
                    .filter(obj -> !obj.key().equals(prefix) && isImage(obj.key()))
                    .sorted(Comparator.comparing(S3Object::key).reversed())
                    .map(obj -> {
                        Map<String, Object> m = new HashMap<>();
                        m.put("key", obj.key());
                        m.put("url", buildImageUrl(obj.key()));
                        m.put("name", getFileName(obj.key()));
                        return m;
                    })
                    .toList();

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
            System.err.println("ERROR in galerie-intern browse for prefix '" + prefix + "': " + e.getMessage());
            Map<String, Object> empty = new HashMap<>();
            empty.put("prefix", prefix);
            empty.put("folders", Collections.emptyList());
            empty.put("images", Collections.emptyList());
            return empty;
        }
    }

    @GetMapping("/thumbnail")
    public ResponseEntity<byte[]> thumbnail(@RequestParam String key) {
        if (!key.startsWith(ROOT)) {
            return ResponseEntity.badRequest().build();
        }
        try {
            byte[] data = thumbnailService.generateSync(key);
            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_JPEG)
                    .header("Cache-Control", "private, max-age=31536000, immutable")
                    .body(data);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    /** Vollbild (Lightbox) - wie /thumbnail auth-gated, aber ohne Verkleinerung. */
    @GetMapping("/image")
    public void image(@RequestParam String key, jakarta.servlet.http.HttpServletResponse response) throws IOException {
        if (!key.startsWith(ROOT)) {
            response.setStatus(400);
            return;
        }
        try {
            GetObjectRequest req = GetObjectRequest.builder().bucket(bucket).key(key).build();
            ResponseInputStream<GetObjectResponse> obj = s3Client.getObject(req);
            GetObjectResponse meta = obj.response();

            response.setContentType(meta.contentType() != null && !meta.contentType().isBlank() ? meta.contentType() : "image/jpeg");
            response.setHeader(HttpHeaders.CACHE_CONTROL, "private, max-age=31536000, immutable");
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

    /** Relative URL zum auth-gated /image-Endpunkt - NICHT die öffentliche R2-URL/den /r2/-Proxy. */
    private String buildImageUrl(String key) {
        return "/api/galerie-intern/image?key=" + java.net.URLEncoder.encode(key, java.nio.charset.StandardCharsets.UTF_8);
    }
}
