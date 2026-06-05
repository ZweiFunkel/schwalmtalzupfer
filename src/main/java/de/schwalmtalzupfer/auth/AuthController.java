package de.schwalmtalzupfer.auth;

import de.schwalmtalzupfer.member.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final MemberRepository memberRepository;

    /**
     * Gibt den aktuell eingeloggten Nutzer zurück.
     * Nicht angemeldet → 200 mit leerem Body (kein 401, damit der Browser nicht warnet).
     */
    @GetMapping("/me")
    public ResponseEntity<?> me(Principal principal) {
        if (principal == null) {
            return ResponseEntity.ok().build();
        }
        return memberRepository.findByEmail(principal.getName())
                .or(() -> memberRepository.findByUsername(principal.getName()))
                .map(m -> {
                    Map<String, Object> dto = new LinkedHashMap<>();
                    dto.put("email", m.getEmail() != null ? m.getEmail() : "");
                    dto.put("username", m.getUsername() != null ? m.getUsername() : "");
                    dto.put("vorname", m.getVorname() != null ? m.getVorname() : "");
                    dto.put("nachname", m.getNachname() != null ? m.getNachname() : "");
                    dto.put("role", "ROLE_" + m.getRole().name());
                    dto.put("istAktiv", m.isIstAktiv());
                    if (m.getGitarrengruppe() != null) {
                        var g = m.getGitarrengruppe();
                        Map<String, Object> gruppeDto = new LinkedHashMap<>();
                        gruppeDto.put("id", g.getId());
                        gruppeDto.put("wochentag", g.getWochentag());
                        gruppeDto.put("vonUhrzeit", g.getVonUhrzeit() != null ? g.getVonUhrzeit().toString() : null);
                        gruppeDto.put("bisUhrzeit", g.getBisUhrzeit() != null ? g.getBisUhrzeit().toString() : null);
                        if (g.getLocation() != null) {
                            Map<String, Object> locDto = new LinkedHashMap<>();
                            locDto.put("name", g.getLocation().getName());
                            locDto.put("adresse", g.getLocation().getAdresse());
                            gruppeDto.put("location", locDto);
                        }
                        dto.put("gruppe", gruppeDto);
                    }
                    return ResponseEntity.ok(dto);
                })
                .orElse(ResponseEntity.status(401).body(Map.of("error", "Nicht gefunden")));
    }
}
