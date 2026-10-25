package de.schwalmtalzupfer.push;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Öffentlicher VAPID-Schlüssel für die Web-App (der Schlüssel ist per Definition nicht geheim). */
@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushController {

    private final WebPushService webPushService;

    @GetMapping("/vapid-public-key")
    public ResponseEntity<?> vapidPublicKey() {
        if (!webPushService.isConfigured()) {
            return ResponseEntity.status(503).body(Map.of("error", "Web Push nicht eingerichtet"));
        }
        return ResponseEntity.ok(Map.of("key", webPushService.publicKey()));
    }
}
