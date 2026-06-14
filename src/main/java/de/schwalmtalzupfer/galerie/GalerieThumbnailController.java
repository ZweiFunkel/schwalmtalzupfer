package de.schwalmtalzupfer.galerie;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/galerie")
@RequiredArgsConstructor
public class GalerieThumbnailController {

    private final ThumbnailService thumbnailService;

    @GetMapping("/thumbnail")
    public ResponseEntity<byte[]> thumbnail(@RequestParam String key) {
        if (!key.startsWith("galerie/")) {
            return ResponseEntity.badRequest().build();
        }
        try {
            byte[] data = thumbnailService.generateSync(key);
            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_JPEG)
                    .header("Cache-Control", "public, max-age=31536000, immutable")
                    .body(data);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }
}
