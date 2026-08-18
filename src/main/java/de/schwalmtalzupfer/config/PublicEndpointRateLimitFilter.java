package de.schwalmtalzupfer.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Bremst Brute-Force/Spam gegen sensible öffentliche POST-Endpoints: 5 Versuche/Minute pro Client-IP + Pfad.
 * In-memory (ein Prozess/Instanz laut Deployment, siehe docs/deployment.md) - kein Redis nötig.
 */
@Component
public class PublicEndpointRateLimitFilter extends OncePerRequestFilter {

    private static final Set<String> PROTECTED_PATHS = Set.of(
            "/api/auth/login",
            "/api/auth/mobile/login",
            "/api/beitritt"
    );

    private final ConcurrentHashMap<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if ("POST".equalsIgnoreCase(request.getMethod()) && PROTECTED_PATHS.contains(request.getRequestURI())) {
            String key = clientIp(request) + "|" + request.getRequestURI();
            Bucket bucket = buckets.computeIfAbsent(key, k -> newBucket());
            if (!bucket.tryConsume(1)) {
                response.setStatus(429);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write("{\"error\":\"Zu viele Versuche. Bitte warte kurz und versuche es erneut.\"}");
                return;
            }
        }
        filterChain.doFilter(request, response);
    }

    private Bucket newBucket() {
        return Bucket.builder()
                .addLimit(Bandwidth.classic(5, Refill.greedy(5, Duration.ofMinutes(1))))
                .build();
    }

    /**
     * X-Forwarded-For/X-Real-IP werden bewusst NICHT mehr ausgewertet: beide Header kann ein
     * Client selbst frei setzen, wodurch sich das Rate-Limit sonst durch einen gefälschten
     * Wert umgehen ließe. CF-Connecting-IP wird von Cloudflare am Edge gesetzt/überschrieben
     * (siehe docs/deployment.md - Cloudflare steht vor der App) und ist daher clientseitig
     * nicht fälschbar, solange der Origin-Server nur über Cloudflare erreichbar ist.
     */
    private String clientIp(HttpServletRequest request) {
        String cfConnectingIp = request.getHeader("CF-Connecting-IP");
        if (cfConnectingIp != null && !cfConnectingIp.isBlank()) {
            return cfConnectingIp.trim();
        }
        return request.getRemoteAddr();
    }
}
