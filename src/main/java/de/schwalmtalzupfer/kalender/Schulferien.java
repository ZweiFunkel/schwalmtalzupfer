package de.schwalmtalzupfer.kalender;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Cache der NRW-Schulferien (synchronisiert via ferien-api.de), Basis für automatische
 * Unterrichts-Ausnahmen während der Ferien (siehe KalenderCalendarService).
 */
@Entity
@Table(name = "schulferien")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Schulferien {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    @Builder.Default
    private String bundesland = "NW";

    @Column(nullable = false)
    private String name;

    @Column(name = "start_datum", nullable = false)
    private LocalDate startDatum;

    @Column(name = "end_datum", nullable = false)
    private LocalDate endDatum;

    @Column(nullable = false)
    private Integer jahr;

    @Column(name = "synced_at", nullable = false)
    @Builder.Default
    private LocalDateTime syncedAt = LocalDateTime.now();
}
