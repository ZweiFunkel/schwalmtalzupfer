package de.schwalmtalzupfer.beitritt;

import de.schwalmtalzupfer.member.Gitarrengruppe;
import de.schwalmtalzupfer.member.GitarrengruppeRepository;
import de.schwalmtalzupfer.member.InvitationService;
import de.schwalmtalzupfer.pricing.PriceGroupRate;
import de.schwalmtalzupfer.pricing.PriceGroupService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/beitritt")
@RequiredArgsConstructor
public class MembershipApplicationController {

    private final MembershipApplicationRepository applicationRepository;
    private final GitarrengruppeRepository gitarrengruppeRepository;
    private final PriceGroupService priceGroupService;
    private final InvitationService invitationService;

    @PostMapping
    public ResponseEntity<?> submit(@RequestBody SubmitRequest req) {
        if (isBlank(req.antragstellerVorname()) || isBlank(req.antragstellerNachname()) || isBlank(req.email())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Vorname, Nachname und E-Mail sind Pflichtfelder."));
        }
        boolean fuerKind = Boolean.TRUE.equals(req.fuerKind());
        if (fuerKind && (isBlank(req.kindVorname()) || isBlank(req.kindNachname()))) {
            return ResponseEntity.badRequest().body(Map.of("error", "Vor- und Nachname des Kindes sind Pflichtfelder."));
        }

        MembershipApplication application = MembershipApplication.builder()
                .antragstellerVorname(req.antragstellerVorname().trim())
                .antragstellerNachname(req.antragstellerNachname().trim())
                .email(req.email().trim())
                .telefon(req.telefon())
                .fuerKind(fuerKind)
                .kindVorname(fuerKind ? req.kindVorname().trim() : null)
                .kindNachname(fuerKind ? req.kindNachname().trim() : null)
                .alterJahre(req.alterJahre())
                .gitarrenErfahrung(req.gitarrenErfahrung())
                .build();

        applicationRepository.save(application);
        return ResponseEntity.ok(Map.of("success", true));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('BOARD', 'ADMIN')")
    public List<Map<String, Object>> list(@RequestParam(required = false) String status) {
        List<MembershipApplication> applications = status != null
                ? applicationRepository.findByStatusOrderByCreatedAtDesc(MembershipApplicationStatus.valueOf(status))
                : applicationRepository.findAllByOrderByCreatedAtDesc();
        return applications.stream().map(this::toDto).toList();
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasAnyRole('BOARD', 'ADMIN')")
    public ResponseEntity<?> update(@PathVariable UUID id, @RequestBody UpdateRequest req) {
        MembershipApplication application = applicationRepository.findById(id).orElse(null);
        if (application == null) {
            return ResponseEntity.notFound().build();
        }

        if (req.gitarrengruppeId() != null) {
            Gitarrengruppe gruppe = gitarrengruppeRepository.findById(UUID.fromString(req.gitarrengruppeId()))
                    .orElseThrow(() -> new IllegalArgumentException("Gruppe nicht gefunden"));
            application.setGitarrengruppe(gruppe);
        }
        if (req.boardNotiz() != null) {
            application.setBoardNotiz(req.boardNotiz());
        }
        if (req.status() != null) {
            MembershipApplicationStatus status = MembershipApplicationStatus.valueOf(req.status());
            if (status == MembershipApplicationStatus.ANGENOMMEN) {
                return ResponseEntity.badRequest().body(Map.of("error",
                        "Annahme läuft über POST /api/beitritt/{id}/annehmen, nicht über diesen Endpoint."));
            }
            application.setStatus(status);
            if (status == MembershipApplicationStatus.ABGELEHNT) {
                application.setDecidedAt(LocalDateTime.now());
            }
        }

        return ResponseEntity.ok(toDto(applicationRepository.save(application)));
    }

    /**
     * Nimmt den Antrag an: erfordert zugewiesene Gitarrengruppe, verschickt die Einladungsmail
     * mit Unterrichtsdetails+Preis (siehe InvitationService.inviteFromApplication). Der eigentliche
     * Vertrag entsteht erst, wenn die Person die Einladung annimmt und eine Zahlungsart hinterlegt.
     */
    @PostMapping("/{id}/annehmen")
    @PreAuthorize("hasAnyRole('BOARD', 'ADMIN')")
    public ResponseEntity<?> annehmen(@PathVariable UUID id) {
        MembershipApplication application = applicationRepository.findById(id).orElse(null);
        if (application == null) {
            return ResponseEntity.notFound().build();
        }
        if (application.getStatus() == MembershipApplicationStatus.ANGENOMMEN) {
            return ResponseEntity.badRequest().body(Map.of("error", "Antrag wurde bereits angenommen."));
        }
        Gitarrengruppe gruppe = application.getGitarrengruppe();
        if (gruppe == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Bitte zuerst eine Unterrichtsgruppe zuweisen."));
        }
        PriceGroupRate rate = priceGroupService.effectiveRate(gruppe.getPriceGroup().getId())
                .orElse(null);
        if (rate == null) {
            return ResponseEntity.badRequest().body(Map.of("error",
                    "Für die Preisgruppe \"" + gruppe.getPriceGroup().getName() + "\" ist noch kein Preis hinterlegt."));
        }

        try {
            invitationService.inviteFromApplication(application.getEmail(), gruppe, rate);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }

        application.setStatus(MembershipApplicationStatus.ANGENOMMEN);
        application.setDecidedAt(LocalDateTime.now());
        return ResponseEntity.ok(toDto(applicationRepository.save(application)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('BOARD', 'ADMIN')")
    public ResponseEntity<?> delete(@PathVariable UUID id) {
        if (!applicationRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        applicationRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private Map<String, Object> toDto(MembershipApplication a) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", a.getId().toString());
        map.put("antragstellerVorname", a.getAntragstellerVorname());
        map.put("antragstellerNachname", a.getAntragstellerNachname());
        map.put("email", a.getEmail());
        map.put("telefon", a.getTelefon());
        map.put("fuerKind", a.isFuerKind());
        map.put("kindVorname", a.getKindVorname());
        map.put("kindNachname", a.getKindNachname());
        map.put("alterJahre", a.getAlterJahre());
        map.put("gitarrenErfahrung", a.getGitarrenErfahrung());
        map.put("status", a.getStatus().name());
        map.put("boardNotiz", a.getBoardNotiz());
        map.put("createdAt", a.getCreatedAt().toString());
        map.put("decidedAt", a.getDecidedAt() != null ? a.getDecidedAt().toString() : null);
        if (a.getGitarrengruppe() != null) {
            Gitarrengruppe g = a.getGitarrengruppe();
            Map<String, Object> gruppeDto = new LinkedHashMap<>();
            gruppeDto.put("id", g.getId().toString());
            gruppeDto.put("wochentag", g.getWochentag());
            gruppeDto.put("vonUhrzeit", g.getVonUhrzeit().toString());
            gruppeDto.put("bisUhrzeit", g.getBisUhrzeit().toString());
            map.put("gitarrengruppe", gruppeDto);
        }
        return map;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    public record SubmitRequest(
            String antragstellerVorname,
            String antragstellerNachname,
            String email,
            String telefon,
            Boolean fuerKind,
            String kindVorname,
            String kindNachname,
            Integer alterJahre,
            String gitarrenErfahrung
    ) {}

    public record UpdateRequest(String gitarrengruppeId, String boardNotiz, String status) {}
}
