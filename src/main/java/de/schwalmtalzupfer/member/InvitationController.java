package de.schwalmtalzupfer.member;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/invitation")
@RequiredArgsConstructor
public class InvitationController {

    private final InvitationService invitationService;

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
            String iban
    ) {}

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
        Member member = invitationService.accept(
                request.token(), request.password(),
                request.vorname(), request.nachname(),
                request.username(), request.iban());
        return ResponseEntity.ok(Map.of("message", "Mitglied " + member.getEmail() + " erfolgreich registriert."));
    }
}
