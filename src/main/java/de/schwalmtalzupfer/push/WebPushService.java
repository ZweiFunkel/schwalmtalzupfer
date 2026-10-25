package de.schwalmtalzupfer.push;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.Security;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Web Push (RFC 8030, VAPID) für die Web-App. Die Browser-Subscription liegt im bestehenden
 * Feld {@code push_token} als {@code webpush:<subscription-json>}; Expo-Tokens bleiben unverändert.
 * Ohne VAPID-Schlüssel ist der Dienst abgeschaltet ({@link #isConfigured()}), die App läuft normal weiter.
 */
@Service
@Slf4j
public class WebPushService {

    public static final String TOKEN_PREFIX = "webpush:";

    public enum Outcome { OK, GONE, FAILED }

    @Value("${app.push.vapid-public:}")
    private String vapidPublic;
    @Value("${app.push.vapid-private:}")
    private String vapidPrivate;
    @Value("${app.push.subject:mailto:billing@novexlabs.de}")
    private String subject;

    private final ObjectMapper mapper = new ObjectMapper();
    private PushService push;

    @PostConstruct
    void init() {
        if (vapidPublic.isBlank() || vapidPrivate.isBlank()) {
            log.warn("Web Push: app.push.vapid-public/-private nicht gesetzt - Web-Benachrichtigungen deaktiviert");
            return;
        }
        try {
            if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
                Security.addProvider(new BouncyCastleProvider());
            }
            push = new PushService(vapidPublic, vapidPrivate, subject);
            log.info("Web Push aktiviert");
        } catch (Exception e) {
            log.error("Web Push: ungültige VAPID-Konfiguration - deaktiviert: {}", e.getMessage());
        }
    }

    public boolean isConfigured() {
        return push != null;
    }

    public String publicKey() {
        return isConfigured() ? vapidPublic : "";
    }

    public static boolean isWebPushToken(String token) {
        return token != null && token.startsWith(TOKEN_PREFIX);
    }

    /** Sendet eine Nachricht an ein Browser-Gerät. Wirft nie; GONE heißt: Subscription ist abgelaufen. */
    public Outcome send(String token, String title, String body, String url) {
        if (push == null || !isWebPushToken(token)) return Outcome.FAILED;
        try {
            JsonNode sub = mapper.readTree(token.substring(TOKEN_PREFIX.length()));
            String endpoint = sub.path("endpoint").asText("");
            String p256dh = sub.path("keys").path("p256dh").asText("");
            String auth = sub.path("keys").path("auth").asText("");
            if (endpoint.isBlank() || p256dh.isBlank() || auth.isBlank()) return Outcome.GONE;

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("title", title);
            payload.put("body", body);
            payload.put("url", url);
            byte[] bytes = mapper.writeValueAsString(payload).getBytes(StandardCharsets.UTF_8);

            HttpResponse r = push.send(new Notification(endpoint, p256dh, auth, bytes, 3600));
            int code = r.getStatusLine().getStatusCode();
            if (code >= 200 && code < 300) return Outcome.OK;
            if (code == 404 || code == 410) return Outcome.GONE;
            log.warn("Web Push: Push-Dienst antwortete mit {}", code);
            return Outcome.FAILED;
        } catch (Exception e) {
            log.warn("Web Push fehlgeschlagen: {}", e.getClass().getSimpleName());
            return Outcome.FAILED;
        }
    }
}
