package de.schwalmtalzupfer.kalender;

import de.schwalmtalzupfer.member.Gitarrengruppe;
import de.schwalmtalzupfer.member.Member;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * "Kein Unterricht an Tag X" - manuelle Ausnahme (z.B. Karneval), optional auf eine
 * Gitarrengruppe beschränkt (NULL = gilt für alle Gruppen). Ferien-bedingter Ausfall wird
 * NICHT hier materialisiert, sondern live gegen {@link Schulferien} berechnet
 * (siehe KalenderCalendarService) - "quelle" existiert nur, falls künftig doch einzelne
 * Ferientage hier gepinnt werden sollen.
 */
@Entity
@Table(name = "kalender_unterricht_ausnahme")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KalenderUnterrichtAusnahme {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private LocalDate datum;

    @Column(nullable = false)
    private String grund;

    /** NULL = gilt für alle Gruppen. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "gitarrengruppe_id")
    private Gitarrengruppe gitarrengruppe;

    /** FERIEN_SYNC | MANUELL */
    @Column(nullable = false)
    @Builder.Default
    private String quelle = "MANUELL";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "erstellt_von")
    private Member erstelltVon;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
