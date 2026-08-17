package de.schwalmtalzupfer.kalender;

import de.schwalmtalzupfer.member.Gitarrengruppe;
import de.schwalmtalzupfer.member.GitarrengruppeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Baut den kombinierten Kalender: manuell angelegte {@link KalenderTermin}-Zeilen PLUS zur
 * Anfragezeit expandierte Unterrichtstermine je Gitarrengruppe (ein Termin pro passendem
 * Wochentag zwischen von/bis), MINUS Ferien-Tage (schulferien) und MINUS manuelle Ausnahmen
 * (kalender_unterricht_ausnahme). Ebenfalls zuständig für den ICS-Export.
 */
@Service
@RequiredArgsConstructor
public class KalenderCalendarService {

    private final KalenderTerminRepository terminRepository;
    private final KalenderUnterrichtAusnahmeRepository ausnahmeRepository;
    private final SchulferienRepository schulferienRepository;
    private final GitarrengruppeRepository gitarrengruppeRepository;

    private static final Map<String, DayOfWeek> WOCHENTAG_MAP = Map.of(
            "Montag", DayOfWeek.MONDAY,
            "Dienstag", DayOfWeek.TUESDAY,
            "Mittwoch", DayOfWeek.WEDNESDAY,
            "Donnerstag", DayOfWeek.THURSDAY,
            "Freitag", DayOfWeek.FRIDAY,
            "Samstag", DayOfWeek.SATURDAY,
            "Sonntag", DayOfWeek.SUNDAY
    );

    /**
     * Kombinierter Kalender für [von, bis] (beide inklusive), sortiert nach Datum/Uhrzeit.
     */
    public List<CalendarEvent> combinedCalendar(LocalDate von, LocalDate bis) {
        List<KalenderTermin> manuelleTermine = terminRepository.findInRange(von, bis);

        // (gitarrengruppeId, datum) Paare, die bereits durch einen manuellen Unterrichtstermin
        // abgedeckt sind - diese dürfen nicht zusätzlich automatisch expandiert werden.
        Set<String> manuellAbgedeckt = manuelleTermine.stream()
                .filter(KalenderTermin::isIstUnterricht)
                .filter(t -> t.getGitarrengruppe() != null)
                .map(t -> t.getGitarrengruppe().getId() + "|" + t.getStartDatum())
                .collect(Collectors.toSet());

        List<CalendarEvent> ergebnis = new ArrayList<>();
        for (KalenderTermin t : manuelleTermine) {
            ergebnis.add(toEvent(t));
        }

        List<KalenderUnterrichtAusnahme> ausnahmen = ausnahmeRepository.findByDatumBetweenOrderByDatumAsc(von, bis);
        List<Schulferien> ferien = schulferienRepository.findByStartDatumLessThanEqualAndEndDatumGreaterThanEqual(bis, von);
        List<Gitarrengruppe> gruppen = gitarrengruppeRepository.findAll();

        for (Gitarrengruppe gruppe : gruppen) {
            DayOfWeek tag = WOCHENTAG_MAP.get(gruppe.getWochentag());
            if (tag == null) continue; // unbekannter/ungültiger Wochentag-Wert - überspringen statt crashen

            for (LocalDate datum = von; !datum.isAfter(bis); datum = datum.plusDays(1)) {
                if (datum.getDayOfWeek() != tag) continue;
                if (manuellAbgedeckt.contains(gruppe.getId() + "|" + datum)) continue;
                if (istFerientag(datum, ferien)) continue;
                if (istManuelleAusnahme(datum, gruppe.getId(), ausnahmen)) continue;

                ergebnis.add(lessonOccurrence(gruppe, datum));
            }
        }

        ergebnis.sort(Comparator
                .comparing(CalendarEvent::startDatum)
                .thenComparing(e -> e.uhrzeitVon() != null ? e.uhrzeitVon() : LocalTime.MIDNIGHT));
        return ergebnis;
    }

    private boolean istFerientag(LocalDate datum, List<Schulferien> ferien) {
        for (Schulferien f : ferien) {
            if (!datum.isBefore(f.getStartDatum()) && !datum.isAfter(f.getEndDatum())) return true;
        }
        return false;
    }

    private boolean istManuelleAusnahme(LocalDate datum, UUID gruppeId, List<KalenderUnterrichtAusnahme> ausnahmen) {
        for (KalenderUnterrichtAusnahme a : ausnahmen) {
            if (!a.getDatum().equals(datum)) continue;
            if (a.getGitarrengruppe() == null || a.getGitarrengruppe().getId().equals(gruppeId)) return true;
        }
        return false;
    }

    private CalendarEvent lessonOccurrence(Gitarrengruppe gruppe, LocalDate datum) {
        String ort = gruppe.getLocation() != null ? gruppe.getLocation().getName() : null;
        return new CalendarEvent(
                "unterricht-" + gruppe.getId() + "-" + datum,
                "Gitarrenunterricht (" + gruppe.getWochentag() + ")",
                "unterricht",
                datum,
                null,
                gruppe.getVonUhrzeit(),
                gruppe.getBisUhrzeit(),
                ort,
                null,
                false,
                null,
                gruppe.getId(),
                true,
                true
        );
    }

    /** Wandelt eine gespeicherte Zeile in ein CalendarEvent um (z.B. direkt nach dem Speichern in der Controller-Antwort). */
    public CalendarEvent toEvent(KalenderTermin t) {
        return new CalendarEvent(
                t.getId().toString(),
                t.getTitel(),
                t.getKategorie(),
                t.getStartDatum(),
                t.getEndDatum(),
                t.getUhrzeitVon(),
                t.getUhrzeitBis(),
                t.getOrt(),
                t.getBeschreibung(),
                t.isAbgesagt(),
                t.getAbsageGrund(),
                t.getGitarrengruppe() != null ? t.getGitarrengruppe().getId() : null,
                t.isIstUnterricht(),
                false
        );
    }

    public Map<String, Object> toDto(CalendarEvent e) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", e.id());
        map.put("titel", e.titel());
        map.put("kategorie", e.kategorie());
        map.put("startDatum", e.startDatum().toString());
        map.put("endDatum", e.endDatum() != null ? e.endDatum().toString() : null);
        map.put("uhrzeitVon", e.uhrzeitVon() != null ? e.uhrzeitVon().toString() : null);
        map.put("uhrzeitBis", e.uhrzeitBis() != null ? e.uhrzeitBis().toString() : null);
        map.put("ort", e.ort());
        map.put("beschreibung", e.beschreibung());
        map.put("abgesagt", e.abgesagt());
        map.put("absageGrund", e.absageGrund());
        map.put("gitarrengruppeId", e.gitarrengruppeId() != null ? e.gitarrengruppeId().toString() : null);
        map.put("istUnterricht", e.istUnterricht());
        map.put("generiert", e.generiert());
        return map;
    }

    // ---------------------------------------------------------------------
    // ICS-Export
    // ---------------------------------------------------------------------

    private static final DateTimeFormatter ICS_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");

    public String buildIcs(List<CalendarEvent> events) {
        StringBuilder sb = new StringBuilder();
        sb.append("BEGIN:VCALENDAR\r\n");
        sb.append("VERSION:2.0\r\n");
        sb.append("PRODID:-//Schwalmtalzupfer//Kalender//DE\r\n");
        sb.append("CALSCALE:GREGORIAN\r\n");
        sb.append("METHOD:PUBLISH\r\n");

        for (CalendarEvent e : events) {
            if (e.abgesagt()) continue; // abgesagte Termine nicht in den Abo-Kalender aufnehmen
            sb.append("BEGIN:VEVENT\r\n");
            sb.append("UID:").append(icsEscape(e.id())).append("@schwalmtalzupfer.de\r\n");
            sb.append("SUMMARY:").append(icsEscape(e.titel())).append("\r\n");

            if (e.uhrzeitVon() != null) {
                sb.append("DTSTART:").append(formatDateTime(e.startDatum(), e.uhrzeitVon())).append("\r\n");
                LocalDate endDatum = e.endDatum() != null ? e.endDatum() : e.startDatum();
                LocalTime endZeit = e.uhrzeitBis() != null ? e.uhrzeitBis() : e.uhrzeitVon();
                sb.append("DTEND:").append(formatDateTime(endDatum, endZeit)).append("\r\n");
            } else {
                // Ganztägig: DTEND ist exklusiv, daher +1 Tag.
                sb.append("DTSTART;VALUE=DATE:").append(e.startDatum().format(ICS_DATE)).append("\r\n");
                LocalDate endDatum = (e.endDatum() != null ? e.endDatum() : e.startDatum()).plusDays(1);
                sb.append("DTEND;VALUE=DATE:").append(endDatum.format(ICS_DATE)).append("\r\n");
            }

            if (e.ort() != null && !e.ort().isBlank()) {
                sb.append("LOCATION:").append(icsEscape(e.ort())).append("\r\n");
            }
            if (e.beschreibung() != null && !e.beschreibung().isBlank()) {
                sb.append("DESCRIPTION:").append(icsEscape(e.beschreibung())).append("\r\n");
            }
            sb.append("END:VEVENT\r\n");
        }

        sb.append("END:VCALENDAR\r\n");
        return sb.toString();
    }

    private String formatDateTime(LocalDate datum, LocalTime zeit) {
        return datum.format(ICS_DATE) + "T"
                + String.format("%02d%02d%02d", zeit.getHour(), zeit.getMinute(), zeit.getSecond());
    }

    /** RFC5545 Text-Escaping für SUMMARY/DESCRIPTION/LOCATION. */
    private String icsEscape(String value) {
        if (value == null) return "";
        return value
                .replace("\\", "\\\\")
                .replace(";", "\\;")
                .replace(",", "\\,")
                .replace("\n", "\\n")
                .replace("\r", "");
    }
}
