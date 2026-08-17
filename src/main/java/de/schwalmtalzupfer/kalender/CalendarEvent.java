package de.schwalmtalzupfer.kalender;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

/**
 * Ein Eintrag im kombinierten Kalender - entweder ein manuell gespeicherter {@link KalenderTermin}
 * oder eine zur Anfragezeit aus einer {@link de.schwalmtalzupfer.member.Gitarrengruppe} expandierte
 * Unterrichts-Vorkommnis ({@code generiert = true}, keine eigene id in der DB).
 */
public record CalendarEvent(
        String id,
        String titel,
        String kategorie,
        LocalDate startDatum,
        LocalDate endDatum,
        LocalTime uhrzeitVon,
        LocalTime uhrzeitBis,
        String ort,
        String beschreibung,
        boolean abgesagt,
        String absageGrund,
        UUID gitarrengruppeId,
        boolean istUnterricht,
        boolean generiert
) {
}
