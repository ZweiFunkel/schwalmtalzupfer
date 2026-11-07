package de.schwalmtalzupfer.storage;

import de.schwalmtalzupfer.config.SiteSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriUtils;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Proxies R2 objects at /r2/** when no public CDN URL is configured.
 */
@RestController
@RequestMapping("/r2")
@RequiredArgsConstructor
public class R2ProxyController {

    private final S3Client s3Client;

    @Value("${app.r2.bucket}")
    private String bucket;

    private final SiteSettingsRepository settings;

    /** Bereiche, die nie ueber den oeffentlichen Proxy ausgeliefert werden (eigene, geschuetzte Endpunkte). */
    private boolean isProtected(String key) {
        if (key.startsWith("_versions/") || key.startsWith("app-releases/")) return true;
        for (String setting : new String[]{"noten_prefix", "galerie_intern_prefix"}) {
            String prefix = settings.findBySettingKey(setting).map(v -> v.getSettingValue()).orElse("");
            if (prefix != null && !prefix.isBlank()) {
                String p = prefix.strip();
                if (!p.endsWith("/")) p = p + "/";
                if (key.startsWith(p)) return true;
            }
        }
        return false;
    }

    @GetMapping("/**")
    public void proxy(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String uri = request.getRequestURI();
        // Strip leading "/r2/"
        // getRequestURI() liefert den rohen, prozentkodierten Pfad ("Logo%20Coenen.jpg") - der R2-Key
        // enthält aber das echte Zeichen, sonst werden Dateien mit Leerzeichen/Umlauten nie gefunden.
        String key = UriUtils.decode(uri.replaceFirst("^/r2/", ""), StandardCharsets.UTF_8);
        if (key.isBlank()) {
            response.setStatus(404);
            return;
        }
        if (isProtected(key)) {
            response.setStatus(404);
            return;
        }
        try {
            GetObjectRequest req = GetObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .build();
            ResponseInputStream<GetObjectResponse> obj = s3Client.getObject(req);
            GetObjectResponse meta = obj.response();

            String contentType = meta.contentType();
            if (contentType == null || contentType.isBlank()) {
                contentType = guessMimeType(key);
            }
            response.setContentType(contentType);
            // Hochgeladene Dateien duerfen auf dieser Domain nie als Skript/HTML ausgefuehrt werden
            response.setHeader("X-Content-Type-Options", "nosniff");
            response.setHeader("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
            String ct = contentType.toLowerCase();
            boolean inlineSafe = (ct.startsWith("image/") && !ct.contains("svg")) || ct.equals("application/pdf")
                    || ct.startsWith("audio/") || ct.startsWith("video/") || ct.startsWith("font/");
            if (!inlineSafe && !ct.contains("svg")) {
                response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment");
            }
            if (meta.contentLength() != null) {
                response.setContentLengthLong(meta.contentLength());
            }
            response.setHeader(HttpHeaders.CACHE_CONTROL, "public, max-age=31536000");

            byte[] buf = new byte[8192];
            int read;
            try (var out = response.getOutputStream()) {
                while ((read = obj.read(buf)) != -1) out.write(buf, 0, read);
            }
        } catch (software.amazon.awssdk.services.s3.model.NoSuchKeyException e) {
            response.setStatus(404);
        }
    }

    private String guessMimeType(String key) {
        String lower = key.toLowerCase();
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return MediaType.IMAGE_JPEG_VALUE;
        if (lower.endsWith(".png")) return MediaType.IMAGE_PNG_VALUE;
        if (lower.endsWith(".gif")) return MediaType.IMAGE_GIF_VALUE;
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".pdf")) return MediaType.APPLICATION_PDF_VALUE;
        return MediaType.APPLICATION_OCTET_STREAM_VALUE;
    }
}

