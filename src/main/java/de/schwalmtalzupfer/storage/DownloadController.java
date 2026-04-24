package de.schwalmtalzupfer.storage;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/admin/download")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class DownloadController {

    private final R2Service r2Service;

    /**
     * Lädt alle Objekte eines Buckets als ZIP herunter.
     */
    @GetMapping("/{bucket}")
    public void downloadBucket(@PathVariable String bucket, HttpServletResponse response) throws IOException {
        response.setContentType("application/zip");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION,
                "attachment; filename=\"" + bucket + ".zip\"");
        r2Service.downloadBucketAsZip(bucket, response.getOutputStream());
    }

    /**
     * Lädt ausgewählte Keys aus dem Standard-Bucket als ZIP herunter.
     * Body: {"keys": ["pfad/datei1.jpg", "pfad/datei2.pdf"]}
     */
    @PostMapping("/keys")
    public void downloadKeys(@RequestBody KeysRequest request, HttpServletResponse response) throws IOException {
        response.setContentType("application/zip");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"download.zip\"");
        r2Service.downloadKeysAsZip(request.keys(), response.getOutputStream());
    }

    public record KeysRequest(List<String> keys) {}
}

