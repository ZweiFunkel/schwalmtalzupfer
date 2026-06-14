package de.schwalmtalzupfer.galerie;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
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
import java.util.List;
import java.util.concurrent.*;

@Service
public class ThumbnailService {

    static final int THUMB_WIDTH = 400;

    private final S3Client s3Client;
    private final String bucket;

    // Parallele Generierung mit bis zu 6 Threads
    private final ExecutorService pool = Executors.newFixedThreadPool(6);

    // key@width → JPEG-Bytes; ConcurrentHashMap ist thread-safe für get/put
    private final ConcurrentHashMap<String, byte[]> cache = new ConcurrentHashMap<>();
    // Verhindert doppelte Arbeit: key wird eingetragen sobald ein Task läuft
    private final ConcurrentHashMap<String, Boolean> inProgress = new ConcurrentHashMap<>();

    ThumbnailService(S3Client s3Client, @Value("${app.r2.bucket}") String bucket) {
        this.s3Client = s3Client;
        this.bucket   = bucket;
    }

    /** Gibt das gecachte Thumbnail zurück oder null wenn noch nicht fertig. */
    byte[] getCached(String key) {
        return cache.get(cacheKey(key));
    }

    /** Generiert ein Thumbnail synchron (blockiert) und gibt es zurück. */
    byte[] generateSync(String key) throws Exception {
        String ck = cacheKey(key);
        byte[] cached = cache.get(ck);
        if (cached != null) return cached;

        byte[] result = generate(key);
        cache.put(ck, result);
        inProgress.remove(key);
        return result;
    }

    /**
     * Startet die Thumbnail-Generierung für alle Keys im Hintergrund.
     * Bereits gecachte oder laufende Keys werden übersprungen.
     */
    void warmAsync(List<String> keys) {
        for (String key : keys) {
            String ck = cacheKey(key);
            if (cache.containsKey(ck)) continue;
            // putIfAbsent gibt null zurück wenn neu eingetragen → Task starten
            if (inProgress.putIfAbsent(key, Boolean.TRUE) == null) {
                pool.submit(() -> {
                    try {
                        byte[] result = generate(key);
                        cache.put(ck, result);
                    } catch (Exception e) {
                        // Fehler still ignorieren; nächster Sync-Request versucht es erneut
                    } finally {
                        inProgress.remove(key);
                    }
                });
            }
        }
    }

    private byte[] generate(String key) throws Exception {
        byte[] original;
        try (ResponseInputStream<GetObjectResponse> is = s3Client.getObject(
                GetObjectRequest.builder().bucket(bucket).key(key).build())) {
            original = is.readAllBytes();
        }

        BufferedImage src = ImageIO.read(new ByteArrayInputStream(original));
        if (src == null) throw new IllegalStateException("ImageIO konnte Bild nicht lesen: " + key);

        BufferedImage scaled = scaleToWidth(src, THUMB_WIDTH);
        return encodeJpeg(scaled, 0.82f);
    }

    private static String cacheKey(String key) {
        return key + "@" + THUMB_WIDTH;
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
}
