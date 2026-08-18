package de.schwalmtalzupfer.member;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Ein Eintrag "ab diesem Datum gilt diese Gitarrengruppe zu diesem Preis" für ein Mitglied.
 * Der jeweils AKTUELL wirksame Eintrag ist der mit dem größten {@code gueltigAb <= heute} -
 * siehe {@link GruppenHistorieService}. Zukünftig datierte Einträge sind bereits geplante,
 * aber noch nicht wirksame Wechsel (z.B. Gruppenwechsel zum 1. des nächsten Monats).
 */
@Entity
@Table(name = "mitglied_gruppen_historie")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MitgliedGruppenHistorie {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    /** null = ab diesem Datum keiner Gruppe (mehr) zugeordnet (z.B. pausiert). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "gitarrengruppe_id")
    private Gitarrengruppe gitarrengruppe;

    /** null = kein Preis hinterlegt (z.B. bei noch nicht erfassten Alt-Verträgen). */
    @Column(name = "monatsbeitrag_cents")
    private Integer monatsbeitragCents;

    @Column(name = "gueltig_ab", nullable = false)
    private LocalDate gueltigAb;

    @Column
    private String notiz;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "erstellt_von")
    private Member erstelltVon;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
