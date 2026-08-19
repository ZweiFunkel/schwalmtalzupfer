package de.schwalmtalzupfer.page;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/pages")
@RequiredArgsConstructor
public class PageController {

    private final PageRepository pageRepository;

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

