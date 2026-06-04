package de.schwalmtalzupfer.contact;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;

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

        // Erst SMTP versuchen, bei Fehler Fallback auf lokales sendmail
        try {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(FROM);
            msg.setTo(TO);
            msg.setReplyTo(req.email());
            msg.setSubject(subject);
            msg.setText(body);
            mailSender.send(msg);
            log.info("Kontaktmail via SMTP gesendet von {}", req.email());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception smtpEx) {
            log.warn("SMTP fehlgeschlagen ({}), versuche sendmail…", smtpEx.getMessage());
        }

        try {
            Process proc = new ProcessBuilder("/usr/sbin/sendmail", "-f", FROM, TO)
                    .redirectErrorStream(true).start();
            String raw = "From: " + FROM + "\r\n"
                    + "To: " + TO + "\r\n"
                    + "Reply-To: " + req.email() + "\r\n"
                    + "Subject: " + subject + "\r\n"
                    + "MIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n"
                    + body;
            try (OutputStream os = proc.getOutputStream()) {
                os.write(raw.getBytes(StandardCharsets.UTF_8));
            }
            int exit = proc.waitFor();
            if (exit != 0) throw new RuntimeException("sendmail exit " + exit);
            log.info("Kontaktmail via sendmail gesendet von {}", req.email());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception sendmailEx) {
            log.error("Mailversand komplett fehlgeschlagen: {}", sendmailEx.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "E-Mail konnte nicht gesendet werden. Bitte wende dich direkt an " + TO));
        }
    }
}
