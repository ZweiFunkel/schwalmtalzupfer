package de.schwalmtalzupfer.kalender;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.HttpClientErrorException;

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
        } catch (HttpClientErrorException.TooManyRequests e) {
            // ferien-api.de ist eine kostenlose öffentliche API mit Rate-Limit - das ist ein
            // erwarteter, harmloser Fehlerfall, kein Serverproblem. Antwort bewusst mit HTTP 200
            // (success:false im Body), damit das nicht wie ein kaputter Server aussieht.
            log.warn("Schulferien-Sync: Rate-Limit von ferien-api.de erreicht.");
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "error", "ferien-api.de hat aktuell ein Rate-Limit erreicht - bitte in ein paar Minuten erneut versuchen."
            ));
        } catch (Exception e) {
            log.error("Manueller Schulferien-Sync fehlgeschlagen: {}", e.getMessage(), e);
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "error", "Schulferien-Sync fehlgeschlagen: " + e.getMessage()
            ));
        }
    }
}
