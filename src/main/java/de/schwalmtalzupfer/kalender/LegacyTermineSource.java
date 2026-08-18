package de.schwalmtalzupfer.kalender;

import de.schwalmtalzupfer.page.PageRepository;
import de.schwalmtalzupfer.page.PageSection;
import de.schwalmtalzupfer.page.SectionType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Liest die bereits vorhandenen, öffentlichen Termine (Konzerte, Ausflüge, ...) aus den
 * CMS-Seiten (TERMINE_LIST-Sektionen, siehe {@link de.schwalmtalzupfer.page.TerminController}
 * für dasselbe Zugriffsmuster) und wandelt sie in {@link CalendarEvent}s um. Diese Termine
 * wurden bisher nur über den "Seiten"-Admin-Tab gepflegt und tauchten im neuen internen
 * Kalender (App/{@code /intern/kalender}) gar nicht auf, obwohl es dieselben Termine sind -
 * ein Termin soll aber nur an einer Stelle gepflegt werden müssen.
 */
@Component
@RequiredArgsConstructor
public class LegacyTermineSource {

    private final PageRepository pageRepository;

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    // Datumsbereiche werden im Frontend mit En-Dash (–) getrennt; ein normaler Bindestrich
    // wird zur Sicherheit ebenfalls erkannt (siehe CLAUDE.md-Hinweis zu dieser Konvention).
    private static final Pattern RANGE_SPLIT = Pattern.compile("[–-]");
    // Erste Uhrzeit aus dem Freitext-Feld "time" herausziehen, z.B. "19:00 Uhr" oder "10:00 - 18:00 Uhr".
    private static final Pattern TIME_PATTERN = Pattern.compile("(\\d{1,2}):(\\d{2})");

    public List<CalendarEvent> load() {
        List<CalendarEvent> result = new ArrayList<>();
        List<PageSection> sections = pageRepository.findAll().stream()
                .flatMap(p -> p.getSections().stream())
                .filter(s -> s.getType() == SectionType.TERMINE_LIST)
                .toList();

        for (PageSection section : sections) {
            Object termineObj = section.getContent().get("termine");
            if (!(termineObj instanceof List<?> list)) continue;
            int index = 0;
            for (Object raw : list) {
                if (raw instanceof Map<?, ?> map) {
                    CalendarEvent event = toEvent(section.getId(), index, castMap(map));
                    if (event != null) result.add(event);
                }
                index++;
            }
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> castMap(Map<?, ?> map) {
        return (Map<String, Object>) map;
    }

    private CalendarEvent toEvent(UUID sectionId, int index, Map<String, Object> t) {
        String dateRaw = str(t.get("date"));
        if (dateRaw == null || dateRaw.isBlank()) return null;

        String[] parts = RANGE_SPLIT.split(dateRaw, 2);
        LocalDate start = parseDate(parts[0]);
        if (start == null) return null;
        LocalDate end = parts.length > 1 ? parseDate(parts[1]) : null;

        String kategorie = str(t.get("kategorie"));
        if (kategorie == null || kategorie.isBlank()) kategorie = "sonstige";

        return new CalendarEvent(
                "cms-" + sectionId + "-" + index,
                Objects.requireNonNullElse(str(t.get("title")), "Termin"),
                kategorie,
                start,
                end,
                parseFirstTime(str(t.get("time"))),
                null,
                str(t.get("location")),
                str(t.get("note")),
                Boolean.TRUE.equals(t.get("cancelled")),
                str(t.get("cancellationNote")),
                null,
                false,
                false
        );
    }

    private LocalDate parseDate(String raw) {
        if (raw == null) return null;
        try {
            return LocalDate.parse(raw.trim(), DATE_FORMAT);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private LocalTime parseFirstTime(String raw) {
        if (raw == null) return null;
        Matcher m = TIME_PATTERN.matcher(raw);
        if (!m.find()) return null;
        try {
            return LocalTime.of(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)));
        } catch (RuntimeException e) {
            return null;
        }
    }

    private String str(Object o) {
        if (o == null) return null;
        String s = o.toString().trim();
        return s.isEmpty() ? null : s;
    }
}
