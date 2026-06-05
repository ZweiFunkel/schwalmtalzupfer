package de.schwalmtalzupfer.contact;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.web.bind.annotation.*;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/contact")
@RequiredArgsConstructor
public class ContactController {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from:noreply@schwalmtalzupfer.de}")
    private String FROM;

    @Value("${app.mail.to:simon.lankes@gmx.de}")
    private String TO;

    public record ContactRequest(String betreff, String email, String nachricht) {}

    @PostMapping
    public ResponseEntity<?> sendContact(@RequestBody ContactRequest req) {
        if (req.betreff() == null || req.betreff().isBlank()
                || req.email() == null || req.email().isBlank()
                || req.nachricht() == null || req.nachricht().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Alle Felder sind Pflichtfelder."));
        }

        String subject = "[Kontaktformular] " + req.betreff();
        String body    = "Nachricht von: " + req.email() + "\n\n" + req.nachricht();

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            helper.setFrom(FROM);
            helper.setTo(TO);
            helper.setReplyTo(req.email());
            helper.setSubject(subject);
            helper.setText(body, false);
            mailSender.send(mimeMessage);
            log.info("Kontaktmail via SMTP gesendet von {}", req.email());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (MessagingException e) {
            log.error("Mailversand fehlgeschlagen: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "E-Mail konnte nicht gesendet werden. Bitte wende dich direkt an " + TO));
        }
    }
}
