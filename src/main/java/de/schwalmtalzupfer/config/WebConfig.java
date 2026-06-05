package de.schwalmtalzupfer.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;
import java.util.Set;

/**
 * Leitet alle Nicht-API-Routen an index.html weiter, damit das Next.js SPA-Routing funktioniert.
 * Erlaubt im Dev-Modus CORS von localhost:3000.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    private static final Set<String> STATIC_EXTENSIONS = Set.of(
            "css", "js", "mjs", "map", "json", "png", "jpg", "jpeg", "gif", "svg", "ico",
            "woff", "woff2", "webp", "txt", "html"
    );

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("http://localhost:3000", "http://localhost:8080")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String resourcePath, Resource location) throws IOException {
                        String path = normalizeResourcePath(resourcePath);

                        // 1. Echte Dateien (JS/CSS/Bilder/…): direkt ausliefern.
                        if (!path.isEmpty()) {
                            Resource requested = location.createRelative(path);
                            if (isServeableFile(requested)) {
                                return requested;
                            }
                        }

                        // 2. Fehlende Build-Assets (_next/static/…) → 404, nicht index.html (sonst MIME-Fehler).
                        if (isStaticAssetPath(path)) {
                            return null;
                        }

                        // 3. SPA-Routen: {path}.html versuchen (Next.js static export mit trailingSlash:false)
                        if (!path.isEmpty()) {
                            Resource htmlFile = location.createRelative(path + ".html");
                            if (isServeableFile(htmlFile)) {
                                return htmlFile;
                            }
                        }

                        // 4. Eltern-Pfad-Fallback: für tiefe Routen (z.B. /galerie/sonstiges/cd-aufnahme)
                        //    den nächsten vorhandenen Elternpfad finden (z.B. galerie.html).
                        //    GalerieModernView liest usePathname() und zeigt den richtigen Ordner.
                        String fallback = path;
                        while (fallback.contains("/")) {
                            fallback = fallback.substring(0, fallback.lastIndexOf('/'));
                            if (!fallback.isEmpty()) {
                                Resource parentHtml = location.createRelative(fallback + ".html");
                                if (isServeableFile(parentHtml)) {
                                    return parentHtml;
                                }
                            }
                        }

                        return new ClassPathResource("/static/index.html");
                    }

                    private String normalizeResourcePath(String resourcePath) {
                        String path = resourcePath == null ? "" : resourcePath;
                        if (path.startsWith("/")) {
                            path = path.substring(1);
                        }
                        while (path.endsWith("/")) {
                            path = path.substring(0, path.length() - 1);
                        }
                        // Remove /index.html if it's at the end, as Next.js exports might not have it for sub-paths
                        if (path.endsWith("/index.html")) {
                            path = path.substring(0, path.length() - "/index.html".length());
                        }
                        return path;
                    }

                    private boolean isServeableFile(Resource resource) throws IOException {
                        if (!resource.exists() || !resource.isReadable()) {
                            return false;
                        }
                        // isFile() ist in JAR-Deployments immer false – stattdessen Stream testen.
                        // Verzeichnisse (z.B. "galerie/") werfen beim Lesen eine IOException.
                        try (var ignored = resource.getInputStream()) {
                            return true;
                        } catch (IOException ex) {
                            return false;
                        }
                    }

                    private boolean isStaticAssetPath(String path) {
                        if (path.startsWith("_next/") || path.startsWith("assets/")) {
                            return true;
                        }
                        int dot = path.lastIndexOf('.');
                        if (dot < 0 || dot == path.length() - 1) {
                            return false;
                        }
                        return STATIC_EXTENSIONS.contains(path.substring(dot + 1).toLowerCase());
                    }

                    @Override
                    protected Resource resolveResourceInternal(
                            HttpServletRequest request, String requestPath,
                            java.util.List<? extends Resource> locations,
                            org.springframework.web.servlet.resource.ResourceResolverChain chain) {
                        if (request != null && request.getRequestURI().startsWith("/api/")) {
                            return null;
                        }
                        return super.resolveResourceInternal(request, requestPath, locations, chain);
                    }
                });
    }
}