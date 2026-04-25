package de.schwalmtalzupfer.page;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@RestController
@RequestMapping("/api/termine")
@RequiredArgsConstructor
public class TerminController {

    private final PageRepository pageRepository;

    /** Returns all termine with kategorie='konzert' from all TERMINE_LIST sections across all pages. */
    @GetMapping("/konzerte")
    public ResponseEntity<List<Map<String, Object>>> getKonzerte() {
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> konzerte = pageRepository.findAll().stream()
                .flatMap(p -> p.getSections().stream())
                .filter(s -> s.getType() == SectionType.TERMINE_LIST)
                .flatMap(s -> {
                    Object termineObj = s.getContent().get("termine");
                    if (!(termineObj instanceof List<?>)) return Stream.empty();
                    return ((List<?>) termineObj).stream()
                            .filter(t -> t instanceof Map<?, ?>)
                            .map(t -> (Map<String, Object>) t)
                            .filter(t -> "konzert".equals(t.get("kategorie")));
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(konzerte);
    }
}