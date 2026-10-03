package de.schwalmtalzupfer.search;

import de.schwalmtalzupfer.page.*;
import de.schwalmtalzupfer.video.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.*;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {
    private final PageRepository pages;
    private final VideoController videos;
    private final StorageSearchService storage;
    private final de.schwalmtalzupfer.i18n.ContentTranslations translations;
    private static final Set<String> TEXT_KEYS = Set.of("headline", "subheadline", "heading", "title", "description", "name", "role", "roles", "bio", "markdown", "conductor", "members", "caption", "altText", "date", "time", "location", "note", "details", "cancellationNote", "info", "text", "intro", "targetGroup", "person", "address", "phone", "mobile", "email", "content", "question", "answer", "quote", "author", "label", "value", "ctaLabel", "buttonLabel");
    public record Result(String title, String excerpt, String href, String kind, String englishTitle, String englishExcerpt) {
        public Result(String title, String excerpt, String href, String kind) { this(title, excerpt, href, kind, title, excerpt); }
    }

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<List<Result>> search(@RequestParam(defaultValue = "") String q, Authentication auth) {
        String query = normalize(q.strip());
        if (query.length() < 2 || query.length() > 150) return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(List.of());
        Set<String> roles = new HashSet<>();
        if (auth != null && auth.isAuthenticated()) auth.getAuthorities().forEach(a -> roles.add(a.getAuthority()));
        boolean signedIn = PageVisibility.signedIn(auth);
        boolean videoAccess = roles.stream().anyMatch(r -> Set.of("ROLE_GUEST", "ROLE_MEMBER", "ROLE_BOARD", "ROLE_ADMIN").contains(r));
        List<Result> results = new ArrayList<>();
        add(results, query, "Gitarrenunterricht ab dem 2. Schuljahr", "Gitarre spielen lernen bei den Schwalmtalzupfern. Anfragen im Kontaktformular oder an info@schwalmtalzupfer.de.", "/gitarrenunterricht", "Seite");
        add(results, query, "Kontakt", "Fragen und Anfragen an info@schwalmtalzupfer.de", "/kontakt", "Seite");
        for (Page page : pages.findAll()) {
            String slug = page.getSlug();
            if (!PageVisibility.canRead(page, auth) || !page.isPublished() || slug == null || !slug.matches("[\\p{L}\\p{N}_/-]+")) continue;
            if ((slug.equals("intern") || slug.startsWith("intern/") || slug.equals("galerie-intern") || slug.equals("noten")) && !signedIn) continue;
            if (slug.equals("admin") || slug.startsWith("admin/")) continue;
            StringBuilder body = new StringBuilder();
            StringBuilder englishBody = new StringBuilder();
            page.getSections().stream().filter(s -> signedIn || s.getType() != SectionType.INTERN_CHANGELOG)
                                .forEach(s -> {
                    body.append(' ').append(visibleText(s.getContent(), false));
                    englishBody.append(' ').append(localizedText(s.getContent(), false, translations.forContent(s.getContent())));
                });
            add(results, query, page.getTitle(), body.toString(), slug.equals("home") ? "/" : "/" + slug, "Seite", englishBody.toString());
        }
        if (videoAccess) {
            for (Video video : videos.getAll()) {
                if ("PLAYLIST".equals(video.getType())) {
                    add(results, query, video.getTitle(), Objects.toString(video.getSubcategory(), ""), "/intern/videos", "Videos");
                    List<PlaylistItem> items = videos.getPlaylistItems(video.getYoutubeId()).getBody();
                    if (items != null) for (PlaylistItem item : items) add(results, query, item.getTitle(), video.getTitle(), "/intern/videos?video=" + encode(item.getVideoId()), "Video");
                } else add(results, query, video.getTitle(), Objects.toString(video.getSubcategory(), "") + " " + Objects.toString(video.getYear(), ""), "/intern/videos?video=" + encode(video.getYoutubeId()), "Video");
            }
        }
        StorageSearchService.Documents documents = storage.documents(signedIn, videoAccess);
        for (Result document : documents.results()) add(results, query, document.title(), document.excerpt(), document.href(), document.kind());
        if (signedIn) add(results, query, "Merchandise und Bestellformular", "Vereinskleidung der Schwalmtalzupfer bestellen", "/intern/merch", "Seite");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
            .header("X-Search-Unavailable", String.join(", ", documents.unavailable()))
            .body(results.stream().distinct().limit(100).toList());
    }
    static String normalize(String value) {
        return Normalizer.normalize(value.toLowerCase(Locale.ROOT).replace("ß", "ss"), Normalizer.Form.NFD).replaceAll("\\p{M}", "").replaceAll("\\s+", " ");
    }
    private static String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
    static String visibleText(Object value, boolean textField) {
        if (value instanceof String s) return textField ? s.replaceAll("<[^>]*>", " ") : "";
        if (value instanceof Map<?, ?> map) return map.entrySet().stream().map(e -> visibleText(e.getValue(), TEXT_KEYS.contains(e.getKey().toString()))).reduce("", (a,b) -> a + " " + b);
        if (value instanceof Collection<?> list) return list.stream().map(v -> visibleText(v, textField)).reduce("", (a,b) -> a + " " + b);
        return "";
    }
    private static String localizedText(Object value, boolean field, Map<String,String> dictionary) {
        if (value instanceof String text) return field ? dictionary.getOrDefault(text, text).replaceAll("<[^>]*>", " ") : "";
        if (value instanceof Map<?,?> map) return map.entrySet().stream().filter(e -> !"_translations".equals(e.getKey())).map(e -> localizedText(e.getValue(), TEXT_KEYS.contains(e.getKey().toString()), dictionary)).reduce("", (a,b) -> a + " " + b);
        if (value instanceof Collection<?> list) return list.stream().map(v -> localizedText(v, field, dictionary)).reduce("", (a,b) -> a + " " + b);
        return "";
    }
    private void add(List<Result> results, String query, String title, String text, String href, String kind) {
        add(results, query, title, text, href, kind, translations.text(text));
    }
    private void add(List<Result> results, String query, String title, String text, String href, String kind, String englishText) {
        if (title == null) return;
        String englishTitle = translations.text(title);
        String haystack = normalize(title + " " + text + " " + englishTitle + " " + englishText);
        if (!Arrays.stream(query.split(" ")).allMatch(haystack::contains)) return;
        results.add(new Result(title, excerpt(text), href, kind, englishTitle, excerpt(englishText)));
    }
    private static String excerpt(String text) {
        String clean = text.replaceAll("\\s+", " ").strip();
        return clean.substring(0, Math.min(200, clean.length()));
    }
}
