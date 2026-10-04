package de.schwalmtalzupfer.i18n;

import de.schwalmtalzupfer.page.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequiredArgsConstructor
public class TranslationController {
    private final PageRepository pages;
    private final ContentTranslations translations;
    @GetMapping("/api/i18n")
    @Transactional(readOnly = true)
    public ResponseEntity<Map<String,String>> english(Authentication auth) {
        Map<String,String> result = new LinkedHashMap<>();
        pages.findAll().stream().filter(page -> PageVisibility.canRead(page, auth)).forEach(page -> {
            translations.collect(page.getTitle(), result);
            page.getSections().stream().filter(section -> PageVisibility.signedIn(auth) || section.getType() != SectionType.INTERN_CHANGELOG)
                .forEach(section -> result.putAll(translations.forContent(PublicPageContent.sanitize(section.getContent()))));
        });
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(result);
    }
}
