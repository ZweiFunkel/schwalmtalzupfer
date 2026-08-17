package de.schwalmtalzupfer.kalender;

import de.schwalmtalzupfer.member.Gitarrengruppe;
import de.schwalmtalzupfer.member.Member;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

/**
 * Ein Termin im internen Kalender (Konzert, Ausflug, Jugend-Event, Unterricht, Sonstiges).
 * Automatisch erzeugte Unterrichtstermine werden zur Anfragezeit aus {@link Gitarrengruppe}
 * expandiert (siehe KalenderCalendarService) und NICHT hier gespeichert - es sei denn, ein
 * einzelner Termin einer Gruppe wird manuell überschrieben (dann gitarrengruppe_id + istUnterricht
 * gesetzt).
 */
@Entity
@Table(name = "kalender_termin")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KalenderTermin {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String titel;

    /** konzert | jugend | ausflug | unterricht | sonstige */
    @Column(nullable = false)
    @Builder.Default
    private String kategorie = "sonstige";

    @Column(name = "start_datum", nullable = false)
    private LocalDate startDatum;

    @Column(name = "end_datum")
    private LocalDate endDatum;

    @Column(name = "uhrzeit_von")
    private LocalTime uhrzeitVon;

    @Column(name = "uhrzeit_bis")
    private LocalTime uhrzeitBis;

    @Column
    private String ort;

    @Column(columnDefinition = "TEXT")
    private String beschreibung;

    @Column(nullable = false)
    @Builder.Default
    private boolean abgesagt = false;

    @Column(name = "absage_grund", columnDefinition = "TEXT")
    private String absageGrund;

    /** Gesetzt bei (manuell überschriebenen) Unterrichtsterminen einer Gruppe. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "gitarrengruppe_id")
    private Gitarrengruppe gitarrengruppe;

    @Column(name = "ist_unterricht", nullable = false)
    @Builder.Default
    private boolean istUnterricht = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "erstellt_von")
    private Member erstelltVon;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();
}
