package de.schwalmtalzupfer.pricing;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "price_group")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PriceGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column
    private String description;
}
