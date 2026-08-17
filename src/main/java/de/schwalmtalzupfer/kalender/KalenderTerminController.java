package de.schwalmtalzupfer.kalender;

import de.schwalmtalzupfer.member.Gitarrengruppe;
import de.schwalmtalzupfer.member.GitarrengruppeRepository;
import de.schwalmtalzupfer.member.Member;
import de.schwalmtalzupfer.member.MemberRepository;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Kombinierter Kalender (öffentlich lesbar, wie /api/termine/**) + CRUD für manuell angelegte
 * Termine (BOARD/ADMIN) + ICS-Export zum Abonnieren in der eigenen Kalender-App.
 */
@RestController
@RequestMapping("/api/kalender")
@RequiredArgsConstructor
public class KalenderTerminController {

    private final KalenderTerminRepository terminRepository;
    private final GitarrengruppeRepository gitarrengruppeRepository;
    private final MemberRepository memberRepository;
    private final KalenderCalendarService calendarService;

    /**
     * Kombinierter Kalender für [von, bis]: manuelle Termine + automatisch expandierte
     * Unterrichtstermine (minus Ferien/Ausnahmen). Öffentlich, keine sensiblen Daten.
     */
    @GetMapping("/termine")
    public List<Map<String, Object>> getTermine(
            @RequestParam(required = false) String von,
            @RequestParam(required = false) String bis) {
        LocalDate[] range = resolveRange(von, bis);
        return calendarService.combinedCalendar(range[0], range[1]).stream()
                .map(calendarService::toDto)
                .toList();
    }

    @PostMapping("/termine")
    @PreAuthorize("hasAnyRole('BOARD', 'ADMIN')")
    public ResponseEntity<?> createTermin(@RequestBody TerminRequest req, Principal principal) {
        if (req.titel() == null || req.titel().isBlank() || req.startDatum() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Titel und Start-Datum sind Pflichtfelder."));
        }

        KalenderTermin.KalenderTerminBuilder builder = KalenderTermin.builder()
                .titel(req.titel().trim())
                .kategorie(req.kategorie() != null ? req.kategorie() : "sonstige")
                .startDatum(LocalDate.parse(req.startDatum()))
                .endDatum(req.endDatum() != null ? LocalDate.parse(req.endDatum()) : null)
                .uhrzeitVon(req.uhrzeitVon() != null ? LocalTime.parse(req.uhrzeitVon()) : null)
                .uhrzeitBis(req.uhrzeitBis() != null ? LocalTime.parse(req.uhrzeitBis()) : null)
                .ort(req.ort())
                .beschreibung(req.beschreibung())
                .abgesagt(Boolean.TRUE.equals(req.abgesagt()))
                .absageGrund(req.absageGrund())
                .istUnterricht(Boolean.TRUE.equals(req.istUnterricht()));

        if (req.gitarrengruppeId() != null && !req.gitarrengruppeId().isBlank()) {
            Gitarrengruppe gruppe = gitarrengruppeRepository.findById(UUID.fromString(req.gitarrengruppeId()))
                    .orElseThrow(() -> new IllegalArgumentException("Gruppe nicht gefunden"));
            builder.gitarrengruppe(gruppe);
        }
        currentMember(principal).ifPresent(builder::erstelltVon);

        KalenderTermin gespeichert = terminRepository.save(builder.build());
        return ResponseEntity.ok(calendarService.toDto(calendarService.toEvent(gespeichert)));
    }

    @PutMapping("/termine/{id}")
    @PreAuthorize("hasAnyRole('BOARD', 'ADMIN')")
    public ResponseEntity<?> updateTermin(@PathVariable UUID id, @RequestBody TerminRequest req) {
        KalenderTermin termin = terminRepository.findById(id).orElse(null);
        if (termin == null) return ResponseEntity.notFound().build();

        if (req.titel() != null) termin.setTitel(req.titel().trim());
        if (req.kategorie() != null) termin.setKategorie(req.kategorie());
        if (req.startDatum() != null) termin.setStartDatum(LocalDate.parse(req.startDatum()));
        termin.setEndDatum(req.endDatum() != null ? LocalDate.parse(req.endDatum()) : null);
        termin.setUhrzeitVon(req.uhrzeitVon() != null ? LocalTime.parse(req.uhrzeitVon()) : null);
        termin.setUhrzeitBis(req.uhrzeitBis() != null ? LocalTime.parse(req.uhrzeitBis()) : null);
        termin.setOrt(req.ort());
        termin.setBeschreibung(req.beschreibung());
        termin.setAbgesagt(Boolean.TRUE.equals(req.abgesagt()));
        termin.setAbsageGrund(req.absageGrund());
        termin.setIstUnterricht(Boolean.TRUE.equals(req.istUnterricht()));
        if (req.gitarrengruppeId() != null && !req.gitarrengruppeId().isBlank()) {
            Gitarrengruppe gruppe = gitarrengruppeRepository.findById(UUID.fromString(req.gitarrengruppeId()))
                    .orElseThrow(() -> new IllegalArgumentException("Gruppe nicht gefunden"));
            termin.setGitarrengruppe(gruppe);
        } else {
            termin.setGitarrengruppe(null);
        }
        termin.setUpdatedAt(java.time.LocalDateTime.now());

        return ResponseEntity.ok(calendarService.toDto(calendarService.toEvent(terminRepository.save(termin))));
    }

    @DeleteMapping("/termine/{id}")
    @PreAuthorize("hasAnyRole('BOARD', 'ADMIN')")
    public ResponseEntity<?> deleteTermin(@PathVariable UUID id) {
        if (!terminRepository.existsById(id)) return ResponseEntity.notFound().build();
        terminRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * ICS-Datei zum Abonnieren/Importieren in die persönliche Kalender-App. Öffentlich
     * erreichbar (wie der GET-Kalender), da Kalender-Apps solche URLs ohne Auth-Header pollen.
     */
    @GetMapping("/ics")
    public void getIcs(
            @RequestParam(required = false) String von,
            @RequestParam(required = false) String bis,
            HttpServletResponse response) throws java.io.IOException {
        LocalDate[] range = resolveRange(von, bis);
        List<CalendarEvent> events = calendarService.combinedCalendar(range[0], range[1]);
        String ics = calendarService.buildIcs(events);

        response.setContentType("text/calendar;charset=UTF-8");
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"kalender.ics\"");
        response.getOutputStream().write(ics.getBytes(StandardCharsets.UTF_8));
        response.getOutputStream().flush();
    }

    private LocalDate[] resolveRange(String von, String bis) {
        LocalDate vonDatum = von != null ? LocalDate.parse(von) : LocalDate.now();
        LocalDate bisDatum = bis != null ? LocalDate.parse(bis) : vonDatum.plusMonths(3);
        return new LocalDate[]{vonDatum, bisDatum};
    }

    private java.util.Optional<Member> currentMember(Principal principal) {
        if (principal == null) return java.util.Optional.empty();
        return memberRepository.findByEmail(principal.getName())
                .or(() -> memberRepository.findByUsername(principal.getName()));
    }

    public record TerminRequest(
            String titel,
            String kategorie,
            String startDatum,
            String endDatum,
            String uhrzeitVon,
            String uhrzeitBis,
            String ort,
            String beschreibung,
            Boolean abgesagt,
            String absageGrund,
            String gitarrengruppeId,
            Boolean istUnterricht
    ) {}
}
