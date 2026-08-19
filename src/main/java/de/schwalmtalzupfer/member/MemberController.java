package de.schwalmtalzupfer.member;

import de.schwalmtalzupfer.payment.MembershipContract;
import de.schwalmtalzupfer.payment.MembershipContractRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/member")
@RequiredArgsConstructor
public class MemberController {

    private final MemberRepository memberRepository;
    private final GitarrengruppeRepository gitarrengruppeRepository;
    private final UserHistoryRepository userHistoryRepository;
    private final MembershipContractRepository membershipContractRepository;
    private final PasswordEncoder passwordEncoder;
    private final GruppenHistorieService gruppenHistorieService;

    /** Eigenes Profil lesen */
    @GetMapping("/me")
    public ResponseEntity<?> myProfile(Principal principal) {
        return memberRepository.findByEmail(principal.getName())
                .or(() -> memberRepository.findByUsername(principal.getName()))
                .map(m -> ResponseEntity.ok(toDto(m)))
                .orElse(ResponseEntity.notFound().build());
    }

    private static final java.util.regex.Pattern USERNAME_PATTERN = java.util.regex.Pattern.compile("^[a-zA-Z0-9._-]{3,50}$");

    /** Eigenes Profil aktualisieren (Vor-/Nachname, Username) - Gäste dürfen ihre Daten nicht ändern. */
    @PatchMapping("/me")
    public ResponseEntity<?> updateProfile(Principal principal, @RequestBody Map<String, String> body) {
        return memberRepository.findByEmail(principal.getName())
                .or(() -> memberRepository.findByUsername(principal.getName()))
                .map(m -> {
                    if (m.getRole() == MemberRole.GUEST) {
                        return ResponseEntity.status(403).body(Map.of("error", "Gäste können ihre Daten nicht ändern."));
                    }
                    if (body.containsKey("vorname")) m.setVorname(body.get("vorname"));
                    if (body.containsKey("nachname")) m.setNachname(body.get("nachname"));
                    if (body.containsKey("username")) {
                        String neuerUsername = body.get("username");
                        if (neuerUsername == null || neuerUsername.isBlank()) {
                            return ResponseEntity.badRequest().body(Map.of("error", "Username darf nicht leer sein."));
                        }
                        neuerUsername = neuerUsername.trim();
                        if (!USERNAME_PATTERN.matcher(neuerUsername).matches()) {
                            return ResponseEntity.badRequest().body(Map.of("error",
                                    "Username muss 3-50 Zeichen lang sein und darf nur Buchstaben, Zahlen, Punkt, Unterstrich oder Bindestrich enthalten."));
                        }
                        boolean unveraendert = neuerUsername.equalsIgnoreCase(m.getUsername());
                        if (!unveraendert && memberRepository.existsByUsernameIgnoreCase(neuerUsername)) {
                            return ResponseEntity.status(409).body(Map.of("error", "Dieser Username ist bereits vergeben."));
                        }
                        m.setUsername(neuerUsername);
                    }
                    return ResponseEntity.ok(toDto(memberRepository.save(m)));
                }).orElse(ResponseEntity.notFound().build());
    }

    /**
     * Eigenes Passwort ändern - verlangt das aktuelle Passwort zur Bestätigung.
     * Gäste dürfen ihr Passwort nicht selbst ändern (geteilte Gast-Zugänge).
     */
    @PatchMapping("/me/password")
    public ResponseEntity<?> changePassword(Principal principal, @RequestBody ChangePasswordRequest req) {
        Optional<Member> memberOpt = memberRepository.findByEmail(principal.getName())
                .or(() -> memberRepository.findByUsername(principal.getName()));
        if (memberOpt.isEmpty()) return ResponseEntity.notFound().build();
        Member m = memberOpt.get();

        if (m.getRole() == MemberRole.GUEST) {
            return ResponseEntity.status(403).body(Map.of("error", "Gäste können ihr Passwort nicht ändern."));
        }
        if (req.neuesPasswort() == null || req.neuesPasswort().length() < 8) {
            return ResponseEntity.badRequest().body(Map.of("error", "Neues Passwort muss mindestens 8 Zeichen lang sein."));
        }
        if (req.aktuellesPasswort() == null || !passwordEncoder.matches(req.aktuellesPasswort(), m.getPasswordHash())) {
            return ResponseEntity.status(403).body(Map.of("error", "Aktuelles Passwort ist falsch."));
        }
        m.setPasswordHash(passwordEncoder.encode(req.neuesPasswort()));
        memberRepository.save(m);
        return ResponseEntity.ok(Map.of("success", true));
    }

    public record ChangePasswordRequest(String aktuellesPasswort, String neuesPasswort) {}

    /** Alle Mitglieder suchen (nur CHEF/ADMIN) */
    @GetMapping
    @PreAuthorize("hasAnyRole('CHEF','ADMIN')")
    public List<Map<String, Object>> allMembers(@RequestParam(required = false) String search) {
        List<Member> members = (search != null && !search.isBlank())
                ? memberRepository.searchMembers(search)
                : memberRepository.findAll();
        return members.stream().map(this::toDto).toList();
    }

    /** Mitglied deaktivieren (nur CHEF/ADMIN) - bei Admins nicht möglich, wenn es der letzte wäre. */
    @PatchMapping("/{id}/deaktivieren")
    @PreAuthorize("hasAnyRole('CHEF','ADMIN')")
    public ResponseEntity<?> deactivate(@PathVariable UUID id) {
        return memberRepository.findById(id).map(m -> {
            if (m.getRole() == MemberRole.ADMIN && memberRepository.countByRole(MemberRole.ADMIN) <= 1) {
                return ResponseEntity.status(409).body(Map.of("error",
                        "Es muss mindestens ein Admin-Account aktiv bleiben. Bitte zuerst einen weiteren Admin bestimmen."));
            }
            m.setIstAktiv(false);
            memberRepository.save(m);
            userHistoryRepository.save(UserHistory.builder()
                    .userId(id)
                    .aenderungsTyp("DEAKTIVIERUNG")
                    .alterWert("aktiv")
                    .neuerWert("inaktiv")
                    .build());
            return ResponseEntity.ok(toDto(m));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Mitglied reaktivieren (nur CHEF/ADMIN) */
    @PatchMapping("/{id}/reaktivieren")
    @PreAuthorize("hasAnyRole('CHEF','ADMIN')")
    public ResponseEntity<?> reactivate(@PathVariable UUID id) {
        return memberRepository.findById(id).map(m -> {
            m.setIstAktiv(true);
            memberRepository.save(m);
            userHistoryRepository.save(UserHistory.builder()
                    .userId(id)
                    .aenderungsTyp("REAKTIVIERUNG")
                    .alterWert("inaktiv")
                    .neuerWert("aktiv")
                    .build());
            return ResponseEntity.ok(toDto(m));
        }).orElse(ResponseEntity.notFound().build());
    }

    /**
     * Gruppe (+ optional individueller Preis) eines Mitglieds ändern (nur CHEF/ADMIN - fachlich
     * Sache des Chefs, der den Unterricht durchführt).
     * Ohne gueltigAb wird die Änderung sofort (heute) wirksam - wie bisher. Mit einem Datum in
     * der Zukunft bleibt die bisherige Gruppe/der bisherige Preis bis dahin sichtbar und die
     * neuen Werte greifen automatisch ab dem Stichtag (siehe {@link GruppenHistorieService}).
     */
    @PatchMapping("/{id}/gruppe")
    @PreAuthorize("hasAnyRole('CHEF','ADMIN')")
    public ResponseEntity<?> updateGruppe(@PathVariable UUID id, @RequestBody UpdateGruppeRequest req, Principal principal) {
        return memberRepository.findById(id).map(m -> {
            String alterWert = gruppeLabel(m.getGitarrengruppe());

            Gitarrengruppe gruppe = null;
            if (req.gruppeId() != null && !req.gruppeId().isBlank()) {
                gruppe = gitarrengruppeRepository.findById(UUID.fromString(req.gruppeId()))
                        .orElseThrow(() -> new IllegalArgumentException("Gruppe nicht gefunden"));
            }
            LocalDate gueltigAb = req.gueltigAb() != null && !req.gueltigAb().isBlank()
                    ? LocalDate.parse(req.gueltigAb())
                    : LocalDate.now();
            Member erstelltVon = currentMember(principal).orElse(null);

            gruppenHistorieService.addEntry(m, gruppe, req.monatsbeitragCents(), gueltigAb, req.notiz(), erstelltVon);

            String neuerWert = gruppeLabel(gruppe) + (gueltigAb.isAfter(LocalDate.now()) ? " (ab " + gueltigAb + ")" : "");
            userHistoryRepository.save(UserHistory.builder()
                    .userId(id)
                    .aenderungsTyp("GRUPPENWECHSEL")
                    .alterWert(alterWert)
                    .neuerWert(neuerWert)
                    .build());
            return ResponseEntity.ok(toDto(memberRepository.findById(id).orElse(m)));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Menschenlesbares Label statt der internen UUID, für die Änderungshistorie. */
    private String gruppeLabel(Gitarrengruppe g) {
        if (g == null) return "keine";
        return g.getWochentag() + " " + g.getVonUhrzeit() + "–" + g.getBisUhrzeit();
    }

    public record UpdateGruppeRequest(String gruppeId, Integer monatsbeitragCents, String gueltigAb, String notiz) {}

    /** Verlauf der Gruppen-/Preis-Zuordnung eines Mitglieds (nur CHEF/ADMIN) - inkl. bereits geplanter, zukünftiger Wechsel. */
    @GetMapping("/{id}/gruppen-historie")
    @PreAuthorize("hasAnyRole('CHEF','ADMIN')")
    public ResponseEntity<?> getGruppenHistorie(@PathVariable UUID id) {
        return memberRepository.findById(id).map(m -> {
            List<Map<String, Object>> historie = gruppenHistorieService.history(m).stream().map(h -> {
                Map<String, Object> map = new LinkedHashMap<>();
                map.put("id", h.getId().toString());
                map.put("gueltigAb", h.getGueltigAb().toString());
                map.put("gruppeId", h.getGitarrengruppe() != null ? h.getGitarrengruppe().getId().toString() : null);
                map.put("gruppeLabel", h.getGitarrengruppe() != null
                        ? h.getGitarrengruppe().getWochentag() + " " + h.getGitarrengruppe().getVonUhrzeit() + "–" + h.getGitarrengruppe().getBisUhrzeit()
                        : "Keine Gruppe");
                map.put("monatsbeitragCents", h.getMonatsbeitragCents());
                map.put("notiz", h.getNotiz());
                map.put("zukuenftig", h.getGueltigAb().isAfter(LocalDate.now()));
                return map;
            }).toList();
            return ResponseEntity.ok(historie);
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Mitglied-Details (nur CHEF/ADMIN) */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('CHEF','ADMIN')")
    public ResponseEntity<?> getMember(@PathVariable UUID id) {
        return memberRepository.findById(id)
                .map(m -> {
                    Map<String, Object> dto = toDto(m);
                    membershipContractRepository.findByMemberId(id).ifPresentOrElse(
                            c -> dto.put("vertrag", contractDto(c)),
                            () -> dto.put("vertrag", null)
                    );
                    return ResponseEntity.ok(dto);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /** Read-only Vertragsübersicht für Vorstand/Admin - nie Kartendaten, nur Status/Betrag. */
    private Map<String, Object> contractDto(MembershipContract c) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("status", c.getStatus().name());
        map.put("startDate", c.getStartDate().toString());
        map.put("amountCents", c.getPriceGroupRate().getAmountCents());
        return map;
    }

    /** UserHistory eines Mitglieds (nur CHEF/ADMIN) */
    @GetMapping("/{id}/history")
    @PreAuthorize("hasAnyRole('CHEF','ADMIN')")
    public ResponseEntity<?> getHistory(@PathVariable UUID id) {
        List<Map<String, Object>> history = userHistoryRepository.findByUserIdOrderByTimestampDesc(id)
                .stream().map(h -> {
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("id", h.getId().toString());
                    map.put("aenderungsTyp", h.getAenderungsTyp());
                    map.put("alterWert", h.getAlterWert());
                    map.put("neuerWert", h.getNeuerWert());
                    map.put("timestamp", h.getTimestamp().toString());
                    return map;
                }).toList();
        return ResponseEntity.ok(history);
    }

    /**
     * Rolle eines Mitglieds ändern (CHEF/ADMIN). Zwei Sicherheitsregeln, die nicht per
     * @PreAuthorize allein abbildbar sind: (1) die ADMIN-Rolle selbst darf nur ein bereits
     * bestehender Admin vergeben - ein Chef kann also niemanden zum Admin machen; (2) der letzte
     * verbleibende Admin-Account darf nicht herabgestuft werden, damit die Anwendung nie ohne
     * Admin dasteht (der aktuelle Admin muss erst selbst einen Nachfolger befördern).
     */
    @PatchMapping("/{id}/rolle")
    @PreAuthorize("hasAnyRole('CHEF','ADMIN')")
    public ResponseEntity<?> updateRolle(@PathVariable UUID id, @RequestBody Map<String, String> body, Principal principal) {
        return memberRepository.findById(id).map(m -> {
            String rolleStr = body.get("rolle");
            MemberRole neueRolle = MemberRole.valueOf(rolleStr);

            boolean requesterIstAdmin = currentMember(principal).map(r -> r.getRole() == MemberRole.ADMIN).orElse(false);
            if (neueRolle == MemberRole.ADMIN && !requesterIstAdmin) {
                return ResponseEntity.status(403).body(Map.of("error", "Nur ein bestehender Admin kann die Admin-Rolle vergeben."));
            }
            if (m.getRole() == MemberRole.ADMIN && neueRolle != MemberRole.ADMIN && memberRepository.countByRole(MemberRole.ADMIN) <= 1) {
                return ResponseEntity.status(409).body(Map.of("error",
                        "Es muss mindestens ein Admin-Account verbleiben. Bitte zuerst einen weiteren Admin bestimmen."));
            }

            String alterWert = m.getRole().name();
            m.setRole(neueRolle);
            memberRepository.save(m);
            userHistoryRepository.save(UserHistory.builder()
                    .userId(id)
                    .aenderungsTyp("ROLLENWECHSEL")
                    .alterWert(alterWert)
                    .neuerWert(neueRolle.name())
                    .build());
            return ResponseEntity.ok(toDto(m));
        }).orElse(ResponseEntity.notFound().build());
    }

    /** Mitglied anlegen (nur CHEF/ADMIN) */
    @PostMapping
    @PreAuthorize("hasAnyRole('CHEF','ADMIN')")
    public ResponseEntity<?> createMember(@RequestBody CreateMemberRequest req) {
        if (memberRepository.existsByEmail(req.email())) {
            return ResponseEntity.badRequest().body(Map.of("error", "E-Mail bereits registriert"));
        }
        Member m = Member.builder()
                .email(req.email())
                .vorname(req.vorname())
                .nachname(req.nachname())
                .passwordHash("$INVITE$") // wird per Einladung gesetzt
                .role(MemberRole.MEMBER)
                .build();
        return ResponseEntity.ok(toDto(memberRepository.save(m)));
    }

    public record CreateMemberRequest(String email, String vorname, String nachname) {}

    private Optional<Member> currentMember(Principal principal) {
        if (principal == null) return Optional.empty();
        return memberRepository.findByEmail(principal.getName())
                .or(() -> memberRepository.findByUsername(principal.getName()));
    }

    Map<String, Object> toDto(Member m) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", m.getId().toString());
        dto.put("email", m.getEmail() != null ? m.getEmail() : "");
        dto.put("username", m.getUsername() != null ? m.getUsername() : "");
        dto.put("vorname", m.getVorname() != null ? m.getVorname() : "");
        dto.put("nachname", m.getNachname() != null ? m.getNachname() : "");
        dto.put("role", m.getRole().name());
        dto.put("istAktiv", m.isIstAktiv());
        dto.put("eintrittsdatum", m.getEintrittsdatum() != null ? m.getEintrittsdatum().toString() : null);
        dto.put("austrittsdatum", m.getAustrittsdatum() != null ? m.getAustrittsdatum().toString() : null);

        GruppenHistorieService.EffectiveAssignment aktuell = gruppenHistorieService.current(m);
        if (aktuell.gruppe() != null) {
            Gitarrengruppe g = aktuell.gruppe();
            Map<String, Object> gruppeMap = new LinkedHashMap<>();
            gruppeMap.put("id", g.getId().toString());
            gruppeMap.put("wochentag", g.getWochentag());
            gruppeMap.put("vonUhrzeit", g.getVonUhrzeit().toString());
            gruppeMap.put("bisUhrzeit", g.getBisUhrzeit().toString());
            if (g.getLocation() != null) {
                Map<String, Object> locMap = new LinkedHashMap<>();
                locMap.put("id", g.getLocation().getId().toString());
                locMap.put("name", g.getLocation().getName());
                locMap.put("adresse", g.getLocation().getAdresse() != null ? g.getLocation().getAdresse() : "");
                locMap.put("parkplatzInfo", g.getLocation().getParkplatzInfo() != null ? g.getLocation().getParkplatzInfo() : "");
                gruppeMap.put("location", locMap);
            }
            dto.put("gruppe", gruppeMap);
        } else {
            dto.put("gruppe", null);
        }
        dto.put("monatsbeitragCents", aktuell.monatsbeitragCents());
        dto.put("individuellerPreis", aktuell.individuellerPreis());

        gruppenHistorieService.next(m).ifPresent(next -> {
            Map<String, Object> naechste = new LinkedHashMap<>();
            naechste.put("gueltigAb", next.getGueltigAb().toString());
            naechste.put("gruppeId", next.getGitarrengruppe() != null ? next.getGitarrengruppe().getId().toString() : null);
            naechste.put("gruppeLabel", next.getGitarrengruppe() != null
                    ? next.getGitarrengruppe().getWochentag() + " " + next.getGitarrengruppe().getVonUhrzeit() + "–" + next.getGitarrengruppe().getBisUhrzeit()
                    : "Keine Gruppe");
            naechste.put("monatsbeitragCents", next.getMonatsbeitragCents());
            dto.put("naechsteAenderung", naechste);
        });

        return dto;
    }
}
