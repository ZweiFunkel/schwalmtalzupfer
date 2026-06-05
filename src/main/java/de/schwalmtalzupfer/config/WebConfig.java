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

                        // Echte Dateien (JS/CSS/Bilder/…): direkt ausliefern – keine Verzeichnisse.
                        if (!path.isEmpty()) {
                            Resource requested = location.createRelative(path);
                            if (isServeableFile(requested)) {
                                return requested;
                            }
                        }

                        // SPA-Route: zuerst path/index.html (z.B. "galerie" → "galerie/index.html").
                        // Wichtig: Verzeichnisse wie "galerie/" dürfen nicht als Treffer gelten,
                        // sonst landet man auf der Root-Startseite.
                        if (!path.isEmpty()) {
                            Resource exactIndex = location.createRelative(path + "/index.html");
                            if (exactIndex.exists() && exactIndex.isReadable()) {
                                return exactIndex;
                            }
                        }

                        // Parent-Fallback für verschachtelte Pfade
                        // (z.B. galerie/sommerkonzerte/2023 → galerie/sommerkonzerte → galerie → root).
                        String walk = path;
                        while (walk.contains("/")) {
                            walk = walk.substring(0, walk.lastIndexOf('/'));
                            Resource parentIndex = location.createRelative(walk + "/index.html");
                            if (parentIndex.exists() && parentIndex.isReadable()) {
                                return parentIndex;
                            }
                        }

                        // Fehlende Build-Assets (_next/static/…) → 404, nicht index.html (sonst MIME-Fehler).
                        if (isStaticAssetPath(path)) {
                            return null;
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

