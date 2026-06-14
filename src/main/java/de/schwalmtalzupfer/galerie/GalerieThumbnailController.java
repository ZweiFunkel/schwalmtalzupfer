package de.schwalmtalzupfer.galerie;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Liefert skalierte JPEG-Thumbnails aus R2.
 * Ergebnisse werden in-memory gecached (kein Neustart nötig).
 */
@RestController
@RequestMapping("/api/galerie")
@RequiredArgsConstructor
public class GalerieThumbnailController {

    private final S3Client s3Client;

    @Value("${app.r2.bucket}")
    private String bucket;

    private final ConcurrentHashMap<String, byte[]> cache = new ConcurrentHashMap<>();

    @GetMapping("/thumbnail")
    public ResponseEntity<byte[]> thumbnail(
            @RequestParam String key,
            @RequestParam(defaultValue = "600") int width
    ) {
        // Nur galerie/-Keys erlauben
        if (!key.startsWith("galerie/")) {
            return ResponseEntity.badRequest().build();
        }

        String cacheKey = key + "@" + width;
        byte[] cached = cache.get(cacheKey);
        if (cached != null) {
            return okJpeg(cached);
        }

        try {
            byte[] original;
            try (ResponseInputStream<GetObjectResponse> is = s3Client.getObject(
                    GetObjectRequest.builder().bucket(bucket).key(key).build())) {
                original = is.readAllBytes();
            }

            BufferedImage src = ImageIO.read(new ByteArrayInputStream(original));
            if (src == null) {
                return ResponseEntity.unprocessableEntity().build();
            }

            BufferedImage scaled = scaleToWidth(src, width);
            byte[] result = encodeJpeg(scaled, 0.85f);

            cache.put(cacheKey, result);
            return okJpeg(result);

        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    private static BufferedImage scaleToWidth(BufferedImage src, int targetWidth) {
        int w = src.getWidth();
        int h = src.getHeight();
        if (w <= targetWidth) return src;

        int targetHeight = (int) Math.round((double) h / w * targetWidth);
        BufferedImage out = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.drawImage(src, 0, 0, targetWidth, targetHeight, null);
        g.dispose();
        return out;
    }

    private static byte[] encodeJpeg(BufferedImage img, float quality) throws Exception {
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        ImageWriteParam param = writer.getDefaultWriteParam();
        param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
        param.setCompressionQuality(quality);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (var ios = ImageIO.createImageOutputStream(baos)) {
            writer.setOutput(ios);
            writer.write(null, new IIOImage(img, null, null), param);
        }
        writer.dispose();
        return baos.toByteArray();
    }

    private static ResponseEntity<byte[]> okJpeg(byte[] data) {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .header("Cache-Control", "public, max-age=31536000, immutable")
                .body(data);
    }
}
