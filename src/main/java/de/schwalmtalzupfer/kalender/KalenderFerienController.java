package de.schwalmtalzupfer.kalender;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Manueller Trigger für den Schulferien-Sync (siehe SchulferienSyncService für die
 * automatische monatliche Ausführung).
 */
@RestController
@RequestMapping("/api/kalender/ferien")
@RequiredArgsConstructor
@Slf4j
public class KalenderFerienController {

    private final SchulferienSyncService schulferienSyncService;

    @PostMapping("/sync")
    @PreAuthorize("hasAnyRole('BOARD', 'ADMIN')")
    public ResponseEntity<?> sync() {
        try {
            int anzahl = schulferienSyncService.syncCurrentAndNextYear();
            return ResponseEntity.ok(Map.of("success", true, "anzahl", anzahl));
        } catch (Exception e) {
            log.error("Manueller Schulferien-Sync fehlgeschlagen: {}", e.getMessage(), e);
            return ResponseEntity.status(502).body(Map.of(
                    "success", false,
                    "error", "Schulferien-Sync fehlgeschlagen: " + e.getMessage()
            ));
        }
    }
}
