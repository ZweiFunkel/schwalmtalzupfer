package de.schwalmtalzupfer.config;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/site")
@RequiredArgsConstructor
public class SiteController {

    private final SiteSettingsRepository siteSettingsRepository;

    @GetMapping("/settings")
    public ResponseEntity<Map<String, String>> getPublicSettings() {
        Map<String, String> result = new HashMap<>();
        siteSettingsRepository.findAll().forEach(s -> {
            if (s.getSettingKey() != null && s.getSettingValue() != null) {
                result.put(s.getSettingKey(), s.getSettingValue());
            }
        });
        return ResponseEntity.ok(result);
    }

    @PutMapping("/announcement")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> saveAnnouncement(@RequestBody Map<String, Object> body) {
        String json = body.get("json") instanceof String s ? s : "";
        SiteSettings setting = siteSettingsRepository.findBySettingKey("announcement")
                .orElse(SiteSettings.builder().id(System.currentTimeMillis()).settingKey("announcement").build());
        setting.setSettingValue(json);
        siteSettingsRepository.save(setting);
        return ResponseEntity.ok().build();
    }
}