package de.schwalmtalzupfer.member;

import de.schwalmtalzupfer.pricing.PriceGroup;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "gitarrengruppe")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Gitarrengruppe {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "location_id")
    private Location location;

    @Column(name = "von_uhrzeit", nullable = false)
    private LocalTime vonUhrzeit;

    @Column(name = "bis_uhrzeit", nullable = false)
    private LocalTime bisUhrzeit;

    @Column(nullable = false)
    private String wochentag;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "price_group_id", nullable = false)
    private PriceGroup priceGroup;
}

