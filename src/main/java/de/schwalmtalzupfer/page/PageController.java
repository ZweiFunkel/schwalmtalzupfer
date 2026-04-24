package de.schwalmtalzupfer.page;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pages")
@RequiredArgsConstructor
public class PageController {

    private final PageRepository pageRepository;

    @GetMapping
    public List<PageDto.PageResponse> listPages() {
        return pageRepository.findAll().stream().map(this::toDto).toList();
    }

    @GetMapping("/{slug}")
    public ResponseEntity<PageDto.PageResponse> getPage(@PathVariable String slug) {
        return pageRepository.findBySlug(slug)
                .map(this::toDto)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public PageDto.PageResponse createPage(@RequestBody PageDto.UpsertPageRequest request) {
        Page page = Page.builder()
                .slug(request.slug())
                .title(request.title())
                .build();
        return toDto(pageRepository.save(page));
    }

    @PostMapping("/{slug}/sections")
    public ResponseEntity<PageDto.PageResponse> addSection(
            @PathVariable String slug,
            @RequestBody PageDto.UpsertSectionRequest request) {
        return pageRepository.findBySlug(slug).map(page -> {
            PageSection section = PageSection.builder()
                    .page(page)
                    .type(request.type())
                    .position(request.position())
                    .content(request.content())
                    .build();
            page.getSections().add(section);
            return ResponseEntity.ok(toDto(pageRepository.save(page)));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{slug}/sections/{sectionId}")
    public ResponseEntity<?> updateSection(
            @PathVariable String slug,
            @PathVariable java.util.UUID sectionId,
            @RequestBody PageDto.UpsertSectionRequest request) {
        return pageRepository.findBySlug(slug).map(page -> {
            page.getSections().stream()
                    .filter(s -> s.getId().equals(sectionId))
                    .findFirst()
                    .ifPresent(s -> {
                        s.setType(request.type());
                        s.setPosition(request.position());
                        s.setContent(request.content());
                    });
            return ResponseEntity.ok(toDto(pageRepository.save(page)));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{slug}/sections/{sectionId}")
    public ResponseEntity<?> deleteSection(
            @PathVariable String slug,
            @PathVariable java.util.UUID sectionId) {
        return pageRepository.findBySlug(slug).map(page -> {
            page.getSections().removeIf(s -> s.getId().equals(sectionId));
            return ResponseEntity.ok(toDto(pageRepository.save(page)));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PatchMapping("/{slug}")
    public ResponseEntity<?> renamePage(
            @PathVariable String slug,
            @RequestBody PageDto.UpsertPageRequest request) {
        return pageRepository.findBySlug(slug).map(page -> {
            if (request.slug() != null && !request.slug().isBlank()) page.setSlug(request.slug().trim());
            if (request.title() != null && !request.title().isBlank()) page.setTitle(request.title().trim());
            return ResponseEntity.ok(toDto(pageRepository.save(page)));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{slug}")
    public ResponseEntity<Object> deletePage(@PathVariable String slug) {
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
        return new PageDto.PageResponse(page.getId(), page.getSlug(), page.getTitle(), sections);
    }
}

