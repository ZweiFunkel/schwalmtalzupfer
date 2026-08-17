package de.schwalmtalzupfer.kalender;

import de.schwalmtalzupfer.member.Member;
import de.schwalmtalzupfer.member.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Eigene Benachrichtigungs-Einstellungen des eingeloggten Mitglieds (App-Settings-Screen).
 * Zugriff nur auf die eigenen Daten - Principal-Auflösung wie in AuthController.me().
 */
@RestController
@RequestMapping("/api/kalender/benachrichtigungen")
@RequiredArgsConstructor
public class KalenderBenachrichtigungController {

    private final KalenderBenachrichtigungEinstellungRepository einstellungRepository;
    private final MemberRepository memberRepository;

    @GetMapping
    public ResponseEntity<?> get(Principal principal) {
        Member member = currentMember(principal);
        if (member == null) return ResponseEntity.status(401).body(Map.of("error", "Nicht angemeldet"));

        KalenderBenachrichtigungEinstellung einstellung = einstellungRepository.findById(member.getId())
                .orElseGet(() -> KalenderBenachrichtigungEinstellung.builder()
                        .memberId(member.getId())
                        .build());
        return ResponseEntity.ok(toDto(einstellung));
    }

    @PutMapping
    public ResponseEntity<?> update(@RequestBody UpdateRequest req, Principal principal) {
        Member member = currentMember(principal);
        if (member == null) return ResponseEntity.status(401).body(Map.of("error", "Nicht angemeldet"));

        KalenderBenachrichtigungEinstellung einstellung = einstellungRepository.findById(member.getId())
                .orElseGet(() -> KalenderBenachrichtigungEinstellung.builder().memberId(member.getId()).build());

        if (req.konzerte() != null) einstellung.setKonzerte(req.konzerte());
        if (req.freizeiten() != null) einstellung.setFreizeiten(req.freizeiten());
        if (req.unterrichtErinnerung() != null) einstellung.setUnterrichtErinnerung(req.unterrichtErinnerung());
        if (req.pushToken() != null) einstellung.setPushToken(req.pushToken().isBlank() ? null : req.pushToken());
        einstellung.setUpdatedAt(LocalDateTime.now());

        return ResponseEntity.ok(toDto(einstellungRepository.save(einstellung)));
    }

    private Member currentMember(Principal principal) {
        if (principal == null) return null;
        return memberRepository.findByEmail(principal.getName())
                .or(() -> memberRepository.findByUsername(principal.getName()))
                .orElse(null);
    }

    private Map<String, Object> toDto(KalenderBenachrichtigungEinstellung e) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("konzerte", e.isKonzerte());
        map.put("freizeiten", e.isFreizeiten());
        map.put("unterrichtErinnerung", e.isUnterrichtErinnerung());
        map.put("pushToken", e.getPushToken());
        return map;
    }

    public record UpdateRequest(Boolean konzerte, Boolean freizeiten, Boolean unterrichtErinnerung, String pushToken) {}
}
