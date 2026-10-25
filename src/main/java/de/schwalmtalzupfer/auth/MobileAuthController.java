package de.schwalmtalzupfer.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Login für die native App: liefert ein JWT statt eines Session-Cookies.
 * Web-Admin-Login (/api/auth/login, formLogin) bleibt unverändert.
 */
@RestController
@RequestMapping("/api/auth/mobile")
@RequiredArgsConstructor
public class MobileAuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            Authentication auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.username(), request.password()));

            String role = auth.getAuthorities().stream()
                    .findFirst().map(GrantedAuthority::getAuthority).orElse("ROLE_MEMBER");
            String token = jwtService.generateToken(auth.getName(), role);

            return ResponseEntity.ok(Map.of("token", token, "role", role));
        } catch (AuthenticationException e) {
            return ResponseEntity.status(401).body(Map.of("error", "Ungültige Anmeldedaten"));
        }
    }
}
