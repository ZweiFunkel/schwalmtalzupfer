package de.schwalmtalzupfer.kalender;

import de.schwalmtalzupfer.member.Gitarrengruppe;
import de.schwalmtalzupfer.member.GitarrengruppeRepository;
import de.schwalmtalzupfer.member.Member;
import de.schwalmtalzupfer.member.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Manuelle "kein Unterricht am Tag X"-Ausnahmen (z.B. Karneval). Ferien-bedingter Ausfall wird
 * live gegen die schulferien-Tabelle berechnet (siehe KalenderCalendarService) und braucht
 * hier keine Zeilen.
 */
@RestController
@RequestMapping("/api/kalender/ausnahmen")
@RequiredArgsConstructor
public class KalenderAusnahmeController {

    private final KalenderUnterrichtAusnahmeRepository ausnahmeRepository;
    private final GitarrengruppeRepository gitarrengruppeRepository;
    private final MemberRepository memberRepository;

    @GetMapping
    @PreAuthorize("hasAnyRole('BOARD', 'ADMIN')")
    public List<Map<String, Object>> list() {
        return ausnahmeRepository.findAllByOrderByDatumAsc().stream().map(this::toDto).toList();
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('BOARD', 'ADMIN')")
    public ResponseEntity<?> create(@RequestBody AusnahmeRequest req, Principal principal) {
        if (req.datum() == null || req.grund() == null || req.grund().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Datum und Grund sind Pflichtfelder."));
        }

        KalenderUnterrichtAusnahme.KalenderUnterrichtAusnahmeBuilder builder = KalenderUnterrichtAusnahme.builder()
                .datum(LocalDate.parse(req.datum()))
                .grund(req.grund().trim())
                .quelle("MANUELL");

        if (req.gitarrengruppeId() != null && !req.gitarrengruppeId().isBlank()) {
            Gitarrengruppe gruppe = gitarrengruppeRepository.findById(UUID.fromString(req.gitarrengruppeId()))
                    .orElseThrow(() -> new IllegalArgumentException("Gruppe nicht gefunden"));
            builder.gitarrengruppe(gruppe);
        }
        currentMember(principal).ifPresent(builder::erstelltVon);

        return ResponseEntity.ok(toDto(ausnahmeRepository.save(builder.build())));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('BOARD', 'ADMIN')")
    public ResponseEntity<?> delete(@PathVariable UUID id) {
        if (!ausnahmeRepository.existsById(id)) return ResponseEntity.notFound().build();
        ausnahmeRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private Optional<Member> currentMember(Principal principal) {
        if (principal == null) return Optional.empty();
        return memberRepository.findByEmail(principal.getName())
                .or(() -> memberRepository.findByUsername(principal.getName()));
    }

    private Map<String, Object> toDto(KalenderUnterrichtAusnahme a) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", a.getId().toString());
        map.put("datum", a.getDatum().toString());
        map.put("grund", a.getGrund());
        map.put("gitarrengruppeId", a.getGitarrengruppe() != null ? a.getGitarrengruppe().getId().toString() : null);
        map.put("quelle", a.getQuelle());
        map.put("createdAt", a.getCreatedAt().toString());
        return map;
    }

    public record AusnahmeRequest(String datum, String grund, String gitarrengruppeId) {}
}
