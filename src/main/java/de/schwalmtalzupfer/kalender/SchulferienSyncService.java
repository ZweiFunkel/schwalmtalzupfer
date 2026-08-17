package de.schwalmtalzupfer.kalender;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.Year;

/**
 * Synchronisiert die NRW-Schulferien von der freien öffentlichen API ferien-api.de in die
 * schulferien-Tabelle (aktuelles + nächstes Jahr). Wird sowohl manuell über
 * POST /api/kalender/ferien/sync als auch monatlich per Scheduler ausgeführt.
 *
 * Hinweis: RestTemplate wird hier bewusst per "new" instanziiert (kein injizierter Bean) -
 * gleiches Muster wie in VideoController.getPlaylistItems, damit keine zusätzliche
 * Jackson-ObjectMapper-Injektion nötig ist (siehe Projektbrief: Jackson 3 hat dafür keinen Bean).
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class SchulferienSyncService {

    private static final String BUNDESLAND = "NW";
    private static final String API_URL_TEMPLATE = "https://ferien-api.de/api/v1/holidays/NW/%d";

    private final SchulferienRepository schulferienRepository;

    /**
     * Holt die Ferien für das aktuelle und das nächste Jahr und legt sie an/aktualisiert sie.
     * @return Anzahl der verarbeiteten Ferien-Einträge.
     * @throws RuntimeException wenn der externe Aufruf fehlschlägt - der Aufrufer (Controller/Scheduler)
     *                          fängt das ab.
     */
    public int syncCurrentAndNextYear() {
        int aktuellesJahr = Year.now().getValue();
        int gesamt = 0;
        gesamt += syncJahr(aktuellesJahr);
        gesamt += syncJahr(aktuellesJahr + 1);
        return gesamt;
    }

    private int syncJahr(int jahr) {
        RestTemplate restTemplate = new RestTemplate();
        String url = String.format(API_URL_TEMPLATE, jahr);
        FerienApiEntry[] entries = restTemplate.getForObject(url, FerienApiEntry[].class);
        if (entries == null) return 0;

        int anzahl = 0;
        for (FerienApiEntry entry : entries) {
            if (entry.name == null || entry.start == null || entry.end == null) continue;
            try {
                LocalDate start = parseDate(entry.start);
                LocalDate end = parseDate(entry.end);

                Schulferien ferien = schulferienRepository
                        .findByBundeslandAndNameAndJahr(BUNDESLAND, entry.name, jahr)
                        .orElseGet(() -> Schulferien.builder()
                                .bundesland(BUNDESLAND)
                                .name(entry.name)
                                .jahr(jahr)
                                .build());
                ferien.setStartDatum(start);
                ferien.setEndDatum(end);
                ferien.setSyncedAt(java.time.LocalDateTime.now());
                schulferienRepository.save(ferien);
                anzahl++;
            } catch (Exception e) {
                log.warn("Konnte Ferien-Eintrag '{}' für {} nicht verarbeiten: {}", entry.name, jahr, e.getMessage());
            }
        }
        return anzahl;
    }

    /** ferien-api.de liefert ISO-8601-Zeitstempel wie "2026-06-29T00:00:00.000Z" - die ersten 10 Zeichen reichen. */
    private LocalDate parseDate(String iso) {
        return LocalDate.parse(iso.substring(0, 10));
    }

    /**
     * Monatlicher automatischer Sync (1. jedes Monats, 03:00 Uhr). Fehler werden geloggt,
     * damit ein Ausfall der externen API nicht die restlichen Scheduled-Jobs blockiert.
     */
    @Scheduled(cron = "0 0 3 1 * *")
    public void scheduledSync() {
        try {
            int anzahl = syncCurrentAndNextYear();
            log.info("Schulferien-Sync (geplant) erfolgreich: {} Einträge verarbeitet.", anzahl);
        } catch (Exception e) {
            log.error("Schulferien-Sync (geplant) fehlgeschlagen: {}", e.getMessage(), e);
        }
    }

    /** Rohes JSON-Element von ferien-api.de. Public Fields, damit Jackson ohne Annotationen deserialisiert. */
    static class FerienApiEntry {
        public String start;
        public String end;
        public String name;
        public String year;
        public String stateCode;
        public String slug;
    }
}
