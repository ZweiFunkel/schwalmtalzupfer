package de.schwalmtalzupfer.member;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class InvitationService {

    private final InvitationTokenRepository tokenRepository;
    private final MemberRepository memberRepository;
    private final JavaMailSender mailSender;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.invitation.base-url}")
    private String baseUrl;

    @Value("${app.invitation.token-validity-hours}")
    private int tokenValidityHours;

    @Value("${app.mail.from:noreply@schwalmtalzupfer.de}")
    private String fromAddress;

    /**
     * Erstellt ein Einladungstoken mit Rolle und verschickt es per E-Mail.
     * BOARD darf nur MEMBER und BOARD einladen; ADMIN darf alle Rollen.
     */
    @Transactional
    public String invite(String email, MemberRole rolle) {
        if (memberRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("E-Mail bereits registriert: " + email);
        }

        // Rollencheck: BOARD darf kein ADMIN einladen
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        if (!isAdmin && rolle == MemberRole.ADMIN) {
            throw new SecurityException("Nur ADMIN darf andere ADMINs einladen.");
        }

        String token = UUID.randomUUID().toString();
        InvitationToken invitation = InvitationToken.builder()
                .token(token)
                .email(email)
                .rolle(rolle)
                .expiresAt(LocalDateTime.now().plusHours(tokenValidityHours))
                .build();
        tokenRepository.save(invitation);

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(email);
            helper.setSubject("Einladung – Schwalmtaler Zupfer");
            helper.setText("Hallo,\n\ndu wurdest eingeladen, dem Schwalmtaler Zupfer beizutreten (Rolle: " + rolle.name() + ").\n"
                    + "Bitte registriere dich unter folgendem Link (gültig für " + tokenValidityHours + " Stunden):\n\n"
                    + baseUrl + "/register?token=" + token + "\n\nViele Grüße", false);
            mailSender.send(mimeMessage);
            log.info("Einladung an {} verschickt (Rolle: {}).", email, rolle);
        } catch (MessagingException e) {
            log.warn("E-Mail-Versand fehlgeschlagen: {}", e.getMessage(), e);
        }
        return token;
    }

    /**
     * Akzeptiert eine Einladung und legt den Member an.
     */
    @Transactional
    public Member accept(String token, String password, String vorname, String nachname, String username, String iban) {
        InvitationToken invitation = tokenRepository.findByToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Ungültiges Token"));

        if (invitation.isUsed()) {
            throw new IllegalStateException("Token bereits verwendet");
        }
        if (invitation.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalStateException("Token abgelaufen");
        }
        if (username != null && !username.isBlank() && memberRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("Username bereits vergeben");
        }

        Member member = Member.builder()
                .email(invitation.getEmail())
                .passwordHash(passwordEncoder.encode(password))
                .vorname(vorname)
                .nachname(nachname)
                .username(username != null && !username.isBlank() ? username : null)
                .iban(iban)
                .role(invitation.getRolle())
                .build();
        memberRepository.save(member);

        invitation.setUsed(true);
        tokenRepository.save(invitation);

        return member;
    }
}
