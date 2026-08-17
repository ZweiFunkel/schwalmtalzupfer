package de.schwalmtalzupfer.kalender;

import de.schwalmtalzupfer.member.Member;
import de.schwalmtalzupfer.member.MemberRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Täglicher Job: informiert Mitglieder per Expo-Push über morgige Termine, je nach ihren
 * Benachrichtigungs-Einstellungen (konzerte / freizeiten / unterrichtErinnerung).
 * Jedes Mitglied wird einzeln in try/catch verarbeitet, damit ein Fehler (z.B. ungültiger
 * Push-Token) nicht den ganzen Batch abbricht.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class KalenderPushNotificationService {

    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

    /** Kategorien, die unter die "freizeiten"-Präferenz fallen. */
    private static final Set<String> FREIZEITEN_KATEGORIEN = Set.of("jugend", "ausflug");

    private final KalenderCalendarService calendarService;
    private final KalenderBenachrichtigungEinstellungRepository einstellungRepository;
    private final MemberRepository memberRepository;

    @Scheduled(cron = "0 0 18 * * *")
    public void scheduledDailyReminder() {
        try {
            int anzahl = sendRemindersForTomorrow();
            log.info("Kalender-Erinnerungen (geplant) verschickt: {}", anzahl);
        } catch (Exception e) {
            log.error("Kalender-Erinnerungen (geplant) fehlgeschlagen: {}", e.getMessage(), e);
        }
    }

    /** @return Anzahl der tatsächlich verschickten Push-Nachrichten. */
    public int sendRemindersForTomorrow() {
        LocalDate morgen = LocalDate.now().plusDays(1);
        List<CalendarEvent> events = calendarService.combinedCalendar(morgen, morgen);
        if (events.isEmpty()) return 0;

        List<KalenderBenachrichtigungEinstellung> einstellungen = einstellungRepository.findByPushTokenIsNotNull();
        int verschickt = 0;
        for (KalenderBenachrichtigungEinstellung einstellung : einstellungen) {
            try {
                verschickt += remindMember(einstellung, events);
            } catch (Exception e) {
                log.warn("Push-Erinnerung für Mitglied {} fehlgeschlagen: {}", einstellung.getMemberId(), e.getMessage());
            }
        }
        return verschickt;
    }

    private int remindMember(KalenderBenachrichtigungEinstellung einstellung, List<CalendarEvent> events) {
        String token = einstellung.getPushToken();
        if (token == null || token.isBlank()) return 0;

        Member member = memberRepository.findById(einstellung.getMemberId()).orElse(null);
        if (member == null) return 0;
        UUID eigeneGruppeId = member.getGitarrengruppe() != null ? member.getGitarrengruppe().getId() : null;

        int verschickt = 0;
        for (CalendarEvent e : events) {
            if (e.abgesagt()) continue;

            boolean relevant;
            if ("konzert".equals(e.kategorie())) {
                relevant = einstellung.isKonzerte();
            } else if (FREIZEITEN_KATEGORIEN.contains(e.kategorie())) {
                relevant = einstellung.isFreizeiten();
            } else if ("unterricht".equals(e.kategorie()) || e.istUnterricht()) {
                relevant = einstellung.isUnterrichtErinnerung()
                        && eigeneGruppeId != null
                        && eigeneGruppeId.equals(e.gitarrengruppeId());
            } else {
                relevant = false;
            }
            if (!relevant) continue;

            sendExpoPush(token, titleFor(e), bodyFor(e));
            verschickt++;
        }
        return verschickt;
    }

    private String titleFor(CalendarEvent e) {
        return switch (e.kategorie()) {
            case "konzert" -> "Morgen: Konzert";
            case "unterricht" -> "Morgen: Gitarrenunterricht";
            case "jugend" -> "Morgen: Jugend-Termin";
            case "ausflug" -> "Morgen: Ausflug";
            default -> "Morgen: Termin";
        };
    }

    private String bodyFor(CalendarEvent e) {
        StringBuilder sb = new StringBuilder(e.titel());
        if (e.uhrzeitVon() != null) {
            sb.append(" um ").append(e.uhrzeitVon());
        }
        if (e.ort() != null && !e.ort().isBlank()) {
            sb.append(", ").append(e.ort());
        }
        return sb.toString();
    }

    /**
     * Feuert eine einzelne Push-Nachricht an Expo's HTTP-API. Kein SDK nötig - einfacher
     * JSON-POST. Gleiche RestTemplate-Instanziierung wie in SchulferienSyncService/VideoController
     * (kein injizierter Bean, kein ObjectMapper-Autowiring).
     */
    private void sendExpoPush(String token, String title, String body) {
        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("to", token);
        payload.put("title", title);
        payload.put("body", body);
        payload.put("sound", "default");

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);
        restTemplate.postForEntity(EXPO_PUSH_URL, entity, String.class);
    }
}
