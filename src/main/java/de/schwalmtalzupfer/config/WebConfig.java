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

/**
 * Leitet alle Nicht-API-Routen an index.html weiter, damit das Next.js SPA-Routing funktioniert.
 * Erlaubt im Dev-Modus CORS von localhost:3000.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

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
                        // Classpath-Verzeichnisse melden exists()+readable, sind aber keine Dateien.
                        if (!resource.isFile()) {
                            return false;
                        }
                        try (var ignored = resource.getInputStream()) {
                            return true;
                        } catch (IOException ex) {
                            return false;
                        }
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

