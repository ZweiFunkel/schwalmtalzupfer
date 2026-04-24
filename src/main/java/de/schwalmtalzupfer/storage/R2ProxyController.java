package de.schwalmtalzupfer.storage;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

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

    @GetMapping("/**")
    public void proxy(HttpServletRequest request, HttpServletResponse response) throws IOException {
        String uri = request.getRequestURI();
        // Strip leading "/r2/"
        String key = uri.replaceFirst("^/r2/", "");
        if (key.isBlank()) {
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

