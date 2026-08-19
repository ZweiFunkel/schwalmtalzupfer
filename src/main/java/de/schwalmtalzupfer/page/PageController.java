package de.schwalmtalzupfer.page;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import de.schwalmtalzupfer.config.SiteSettings;
import de.schwalmtalzupfer.config.SiteSettingsRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/pages")
@RequiredArgsConstructor
public class PageController {

    private final PageRepository pageRepository;
    private final SiteSettingsRepository siteSettingsRepository;
    private static final String NAV_CONFIG_KEY = "nav_config";
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String API_PREFIX = "/api/pages/";

    /** Extrahiert den vollen Slug aus dem Request-URI (unterstützt Slugs mit Schrägstrichen). */
    private String extractSlug(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (uri.startsWith(API_PREFIX)) {
            return uri.substring(API_PREFIX.length());
        }
        return uri;
    }

    /** Extrahiert den Slug und entfernt einen bekannten Suffix (z.B. "/sections" oder "/sections/{uuid}"). */
    private String extractSlugWithoutSuffix(HttpServletRequest request, String suffix) {
        String full = extractSlug(request);
        if (full.endsWith(suffix)) {
            return full.substring(0, full.length() - suffix.length());
        }
        return full;
    }

    private static boolean isAdmin(Authentication auth) {
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
    }

    @GetMapping
    public List<PageDto.PageResponse> listPages(Authentication authentication) {
        boolean admin = isAdmin(authentication);
        return pageRepository.findAll().stream()
                .filter(p -> admin || p.isPublished())
                .map(this::toDto)
                .toList();
    }

    @GetMapping("/**")
    public ResponseEntity<PageDto.PageResponse> getPage(HttpServletRequest request, Authentication authentication) {
        String slug = extractSlug(request);
        boolean admin = isAdmin(authentication);
        return pageRepository.findBySlug(slug)
                .filter(p -> admin || p.isPublished())
                .map(this::toDto)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public PageDto.PageResponse createPage(@RequestBody PageDto.UpsertPageRequest request) {
        Page page = Page.builder()
                .slug(request.slug())
                .title(request.title())
                .build();
        return toDto(pageRepository.save(page));
    }

    @PostMapping("/**/sections")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PageDto.PageResponse> addSection(
            HttpServletRequest request,
            @RequestBody PageDto.UpsertSectionRequest body) {
        String slug = extractSlugWithoutSuffix(request, "/sections");
        return pageRepository.findBySlug(slug).map(page -> {
            PageSection section = PageSection.builder()
                    .page(page)
                    .type(body.type())
                    .position(body.position())
                    .content(body.content())
                    .build();
            page.getSections().add(section);
            return ResponseEntity.ok(toDto(pageRepository.save(page)));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/**/sections/{sectionId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateSection(
            HttpServletRequest request,
            @PathVariable UUID sectionId,
            @RequestBody PageDto.UpsertSectionRequest body) {
        String slug = extractSlugWithoutSuffix(request, "/sections/" + sectionId);
        return pageRepository.findBySlug(slug).map(page -> {
            page.getSections().stream()
                    .filter(s -> s.getId().equals(sectionId))
                    .findFirst()
                    .ifPresent(s -> {
                        s.setType(body.type());
                        s.setPosition(body.position());
                        s.setContent(body.content());
                    });
            return ResponseEntity.ok(toDto(pageRepository.save(page)));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/**/sections/{sectionId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteSection(
            HttpServletRequest request,
            @PathVariable UUID sectionId) {
        String slug = extractSlugWithoutSuffix(request, "/sections/" + sectionId);
        return pageRepository.findBySlug(slug).map(page -> {
            page.getSections().removeIf(s -> s.getId().equals(sectionId));
            return ResponseEntity.ok(toDto(pageRepository.save(page)));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * Schaltet ausschließlich die Menü-Sichtbarkeit (nav_config.hidden) einer Seite um,
     * ohne den restlichen Settings-Blob (Logo, Meldungen, Navigation-Dropdowns, ...)
     * anzufassen - im Gegensatz zu PUT /api/admin/settings, das den kompletten Blob per
     * Read-Modify-Write überschreibt und deshalb bewusst ADMIN-only bleibt. Für CHEF/ADMIN
     * gedacht, z.B. als schnelle Aktion aus der Mobile-App.
     * Einschränkung: erfasst nur einfache, einteilige Slugs (kein "/" im Slug) - für
     * verschachtelte Seiten-Slugs (selten) müsste man die {@code /**}-Extraktion wie bei
     * den übrigen Endpunkten hier nutzen; für den Anwendungsfall "Seite im Menü
     * verstecken" ist das nicht nötig.
     */
    @PatchMapping("/{slug}/menu-visibility")
    @PreAuthorize("hasAnyRole('CHEF','ADMIN')")
    public ResponseEntity<?> updateMenuVisibility(@PathVariable String slug, @RequestBody MenuVisibilityRequest body) {
        if (body.hidden() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Feld 'hidden' ist Pflicht."));
        }
        SiteSettings setting = siteSettingsRepository.findBySettingKey(NAV_CONFIG_KEY)
                .orElseGet(() -> SiteSettings.builder().id(System.currentTimeMillis()).settingKey(NAV_CONFIG_KEY).build());

        Map<String, Object> config;
        try {
            String raw = setting.getSettingValue();
            config = (raw == null || raw.isBlank())
                    ? new LinkedHashMap<>()
                    : objectMapper.readValue(raw, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "nav_config konnte nicht gelesen werden."));
        }

        List<String> hidden = new ArrayList<>();
        if (config.get("hidden") instanceof List<?> list) {
            for (Object o : list) {
                if (o != null) hidden.add(o.toString());
            }
        }
        if (body.hidden()) {
            if (!hidden.contains(slug)) hidden.add(slug);
        } else {
            hidden.remove(slug);
        }
        config.put("hidden", hidden);

        try {
            setting.setSettingValue(objectMapper.writeValueAsString(config));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "nav_config konnte nicht gespeichert werden."));
        }
        siteSettingsRepository.save(setting);
        return ResponseEntity.ok(Map.of("slug", slug, "hidden", body.hidden()));
    }

    public record MenuVisibilityRequest(Boolean hidden) {}

    @PatchMapping("/**")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> renamePage(
            HttpServletRequest request,
            @RequestBody PageDto.UpsertPageRequest body) {
        String slug = extractSlug(request);
        return pageRepository.findBySlug(slug).map(page -> {
            if (body.slug() != null && !body.slug().isBlank()) page.setSlug(body.slug().trim());
            if (body.title() != null && !body.title().isBlank()) page.setTitle(body.title().trim());
            if (body.published() != null) page.setPublished(body.published());
            return ResponseEntity.ok(toDto(pageRepository.save(page)));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/**")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Object> deletePage(HttpServletRequest request) {
        String slug = extractSlug(request);
        return pageRepository.findBySlug(slug).map(page -> {
            pageRepository.delete(page);
            return ResponseEntity.<Void>noContent().build();
        }).orElse(ResponseEntity.notFound().build());
    }

    private PageDto.PageResponse toDto(Page page) {
        List<PageDto.SectionResponse> sections = page.getSections().stream()
                .map(s -> PageDto.SectionResponse.builder()
                        .id(s.getId())
                        .type(s.getType())
                        .position(s.getPosition())
                        .content(s.getContent())
                        .build())
                .toList();
        return new PageDto.PageResponse(page.getId(), page.getSlug(), page.getTitle(), page.isPublished(), sections);
    }
}

