package de.schwalmtalzupfer.storage;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
@RequiredArgsConstructor
@Slf4j
public class R2Service {

    private final S3Client s3Client;

    @Value("${app.r2.bucket}")
    private String defaultBucket;

    /**
     * Schreibt eine Liste von S3-Keys als ZIP in den übergebenen OutputStream.
     *
     * @param keys   Liste der Object-Keys im Bucket
     * @param output Ziel-OutputStream (z. B. HttpServletResponse.getOutputStream())
     */
    public void downloadKeysAsZip(List<String> keys, OutputStream output) throws IOException {
        try (ZipOutputStream zip = new ZipOutputStream(output)) {
            for (String key : keys) {
                try {
                    GetObjectRequest request = GetObjectRequest.builder()
                            .bucket(defaultBucket)
                            .key(key)
                            .build();
                    ResponseInputStream<GetObjectResponse> s3Object = s3Client.getObject(request);
                    // Dateiname aus dem Key extrahieren
                    String entryName = key.contains("/") ? key.substring(key.lastIndexOf('/') + 1) : key;
                    zip.putNextEntry(new ZipEntry(entryName));
                    copyStream(s3Object, zip);
                    zip.closeEntry();
                } catch (NoSuchKeyException e) {
                    log.warn("Key nicht gefunden, wird übersprungen: {}", key);
                }
            }
            zip.finish();
        }
    }

    /**
     * Lädt alle Objekte eines Buckets als ZIP-Stream herunter.
     *
     * @param bucket Name des Buckets
     * @param output Ziel-OutputStream
     */
    public void downloadBucketAsZip(String bucket, OutputStream output) throws IOException {
        ListObjectsV2Request listRequest = ListObjectsV2Request.builder().bucket(bucket).build();
        List<String> keys = s3Client.listObjectsV2(listRequest)
                .contents().stream()
                .map(S3Object::key)
                .toList();
        downloadKeysAsZip(keys, output);
    }

    /**
     * Lädt ein einzelnes Objekt in den Bucket hoch.
     *
     * @param bucket      Ziel-Bucket
     * @param key         Objekt-Key
     * @param inputStream Datei-Inhalt
     * @param contentType MIME-Type
     * @param length      Dateilänge in Bytes
     */
    public void upload(String bucket, String key, InputStream inputStream, String contentType, long length) {
        s3Client.putObject(
                PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .contentType(contentType)
                        .contentLength(length)
                        .build(),
                software.amazon.awssdk.core.sync.RequestBody.fromInputStream(inputStream, length));
    }

    private void copyStream(InputStream in, OutputStream out) throws IOException {
        byte[] buffer = new byte[8192];
        int read;
        while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
        }
    }
}

