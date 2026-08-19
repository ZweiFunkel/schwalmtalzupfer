package de.schwalmtalzupfer.member;

import de.schwalmtalzupfer.payment.RegistrationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/invitation")
@RequiredArgsConstructor
public class InvitationController {

    private final InvitationService invitationService;
    private final RegistrationService registrationService;

    public record InviteRequest(
            @Email @NotBlank String email,
            String rolle  // z.B. "MEMBER", "BOARD", "ADMIN"
    ) {}

    public record AcceptRequest(
            @NotBlank String token,
            @NotBlank String password,
            String vorname,
            String nachname,
            String username,
            String iban,
            String stripeCustomerId,
            String stripePaymentMethodId
    ) {}

    /**
     * Details zu einer offenen Einladung (Gruppe/Preis), damit die Registrierungsseite
     * vor dem Absenden anzeigen kann, was auf die Person zukommt. Öffentlich, da vor Login.
     */
    @GetMapping("/details")
    public ResponseEntity<?> details(@RequestParam String token) {
        InvitationToken invitation;
        try {
            invitation = invitationService.peekToken(token);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", "Ungültiges Token"));
        }
        if (invitation.isUsed() || invitation.getExpiresAt().isBefore(LocalDateTime.now())) {
            return ResponseEntity.status(410).body(Map.of("error", "Einladung abgelaufen oder bereits verwendet"));
        }

        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("email", invitation.getEmail());
        dto.put("expiresAt", invitation.getExpiresAt().toString());
        if (invitation.getGitarrengruppe() != null) {
            Gitarrengruppe g = invitation.getGitarrengruppe();
            Map<String, Object> gruppeDto = new LinkedHashMap<>();
            gruppeDto.put("wochentag", g.getWochentag());
            gruppeDto.put("vonUhrzeit", g.getVonUhrzeit().toString());
            gruppeDto.put("bisUhrzeit", g.getBisUhrzeit().toString());
            if (g.getLocation() != null) gruppeDto.put("location", g.getLocation().getName());
            dto.put("gitarrengruppe", gruppeDto);
        }
        if (invitation.getPriceGroupRate() != null) {
            dto.put("amountCents", invitation.getPriceGroupRate().getAmountCents());
        }
        return ResponseEntity.ok(dto);
    }

    /**
     * Einladung versenden (BOARD oder ADMIN).
     */
    @PostMapping("/invite")
    @PreAuthorize("hasAnyRole('BOARD','ADMIN')")
    public ResponseEntity<?> invite(@Valid @RequestBody InviteRequest request) {
        MemberRole rolle = MemberRole.MEMBER;
        if (request.rolle() != null && !request.rolle().isBlank()) {
            try {
                rolle = MemberRole.valueOf(request.rolle().toUpperCase());
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body(Map.of("error", "Ungültige Rolle: " + request.rolle()));
            }
        }
        String token = invitationService.invite(request.email(), rolle);
        return ResponseEntity.ok(Map.of(
                "message", "Einladung an " + request.email() + " verschickt.",
                "token", token,
                "registerUrl", "/register?token=" + token
        ));
    }

    /**
     * Einladung annehmen und Konto erstellen.
     */
    @PostMapping("/accept")
    public ResponseEntity<?> accept(@Valid @RequestBody AcceptRequest request) {
        InvitationToken invitation;
        try {
            invitation = invitationService.peekToken(request.token());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", "Ungültiges Token"));
        }

        if (invitation.getPriceGroupRate() != null
                && (request.stripeCustomerId() == null || request.stripePaymentMethodId() == null)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Zahlungsart fehlt - bitte zuerst den Zahlungsschritt abschließen."));
        }

        Member member;
        try {
            member = invitationService.accept(
                    request.token(), request.password(),
                    request.vorname(), request.nachname(),
                    request.username(), request.iban());
        } catch (IllegalStateException e) {
            return ResponseEntity.status(410).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
        }

        if (invitation.getPriceGroupRate() != null) {
            try {
                registrationService.completeContract(member, invitation.getPriceGroupRate(),
                        request.stripeCustomerId(), request.stripePaymentMethodId());
            } catch (IllegalStateException e) {
                // Konto existiert bereits, Zahlungseinrichtung ist fehlgeschlagen -
                // Mitglied kann sich einloggen und Zahlungsart über /api/payment/portal-session nachtragen.
                return ResponseEntity.ok(Map.of(
                        "message", "Konto erstellt, aber Zahlungseinrichtung fehlgeschlagen: " + e.getMessage()
                                + " Bitte im Mitgliederbereich nachholen."
                ));
            }
        }

        return ResponseEntity.ok(Map.of("message", "Mitglied " + member.getEmail() + " erfolgreich registriert."));
    }
}
