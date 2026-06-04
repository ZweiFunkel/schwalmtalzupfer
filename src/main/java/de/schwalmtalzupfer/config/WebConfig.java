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
                        Resource requested = location.createRelative(resourcePath);
                        if (requested.exists() && requested.isReadable()) {
                            return requested;
                        }
                        // Suche den nächsten Parent-Ordner mit index.html (SPA-Fallback).
                        // Beispiel: galerie/sommerkonzerte/2023 → galerie/sommerkonzerte → galerie → root
                        String path = resourcePath.endsWith("/index.html")
                                ? resourcePath.substring(0, resourcePath.length() - "/index.html".length())
                                : resourcePath;
                        // Zuerst: exakten Pfad + /index.html probieren (z.B. "galerie" → "galerie/index.html")
                        if (!path.isEmpty()) {
                            Resource exactIndex = location.createRelative(path + "/index.html");
                            if (exactIndex.exists() && exactIndex.isReadable()) {
                                return exactIndex;
                            }
                        }
                        // Letztes Segment entfernen bis index.html gefunden oder root
                        while (path.contains("/")) {
                            path = path.substring(0, path.lastIndexOf('/'));
                            Resource parentIndex = location.createRelative(
                                    path.isEmpty() ? "index.html" : path + "/index.html");
                            if (parentIndex.exists() && parentIndex.isReadable()) {
                                return parentIndex;
                            }
                        }
                        return new ClassPathResource("/static/index.html");
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

