package de.schwalmtalzupfer.config;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/site")
@RequiredArgsConstructor
public class SiteController {

    private final SiteSettingsRepository siteSettingsRepository;

    /**
     * Public endpoint to read site settings (e.g., logo URL).
     */
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
}