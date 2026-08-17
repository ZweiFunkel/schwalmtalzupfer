package de.schwalmtalzupfer.appupdate;

import de.schwalmtalzupfer.config.SiteSettings;
import de.schwalmtalzupfer.config.SiteSettingsRepository;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Nimmt neue Android-Release-Builds von der CI (GitHub Actions) entgegen und liefert sie
 * an die App zum Sideload-Update aus. Für Nutzer der Mobile-App gedacht, solange die App
 * noch nicht im Play Store ist (dort übernimmt Play den Update-Mechanismus).
 *
 * Die Versions-Metadaten landen unter dem site_settings-Key "android_app_version" und
 * werden von der App ganz normal über GET /api/site/settings gelesen (wie z.B. noten_prefix).
 */
@RestController
@RequestMapping("/api/app/android")
@RequiredArgsConstructor
public class AppUpdateController {

    private static final String SETTINGS_KEY = "android_app_version";
    private static final String APK_KEY = "app-releases/android-latest.apk";

    private final SiteSettingsRepository siteSettingsRepository;
    private final S3Client s3Client;

    @Value("${app.r2.bucket}")
    private String bucket;

    @Value("${app.deploy.token}")
    private String deployToken;

    @GetMapping("/download")
    public void download(HttpServletResponse response) throws IOException {
        try {
            GetObjectRequest req = GetObjectRequest.builder().bucket(bucket).key(APK_KEY).build();
            ResponseInputStream<GetObjectResponse> obj = s3Client.getObject(req);

            response.setContentType("application/vnd.android.package-archive");
            response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"Schwalmtalzupfer.apk\"");
            if (obj.response().contentLength() != null) response.setContentLengthLong(obj.response().contentLength());

            byte[] buf = new byte[8192];
            int read;
            try (var out = response.getOutputStream()) {
                while ((read = obj.read(buf)) != -1) out.write(buf, 0, read);
            }
        } catch (NoSuchKeyException e) {
            response.setStatus(404);
        }
    }

    @PostMapping("/publish")
    public ResponseEntity<Void> publish(
            @RequestHeader("X-Deploy-Token") String token,
            @RequestParam("versionCode") int versionCode,
            @RequestParam("versionName") String versionName,
            @RequestParam(value = "releaseNotes", defaultValue = "") String releaseNotes,
            @RequestParam("apk") MultipartFile apk
    ) throws IOException {
        if (!constantTimeEquals(deployToken, token)) {
            return ResponseEntity.status(403).build();
        }

        s3Client.putObject(
                software.amazon.awssdk.services.s3.model.PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(APK_KEY)
                        .contentType("application/vnd.android.package-archive")
                        .contentLength(apk.getSize())
                        .build(),
                software.amazon.awssdk.core.sync.RequestBody.fromInputStream(apk.getInputStream(), apk.getSize()));

        String json = toJson(versionCode, versionName, releaseNotes);

        SiteSettings setting = siteSettingsRepository.findBySettingKey(SETTINGS_KEY)
                .orElse(SiteSettings.builder().id(System.currentTimeMillis()).settingKey(SETTINGS_KEY).build());
        setting.setSettingValue(json);
        siteSettingsRepository.save(setting);

        return ResponseEntity.ok().build();
    }

    private boolean constantTimeEquals(String expected, String actual) {
        if (expected == null || actual == null) return false;
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                actual.getBytes(StandardCharsets.UTF_8));
    }

    private String toJson(int versionCode, String versionName, String releaseNotes) {
        return "{\"versionCode\":" + versionCode
                + ",\"versionName\":\"" + escapeJson(versionName) + "\""
                + ",\"releaseNotes\":\"" + escapeJson(releaseNotes) + "\"}";
    }

    private String escapeJson(String value) {
        if (value == null) return "";
        StringBuilder sb = new StringBuilder(value.length());
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
                }
            }
        }
        return sb.toString();
    }
}
