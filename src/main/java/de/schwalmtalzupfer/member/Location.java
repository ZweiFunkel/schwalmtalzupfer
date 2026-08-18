package de.schwalmtalzupfer.member;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "location")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Location {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column
    private String adresse;

    /** Freitext-Hinweis zu Parkmöglichkeiten (nur von Vorstand/Admin gepflegt), z.B. "Parkplatz hinter der Kirche". */
    @Column(name = "parkplatz_info")
    private String parkplatzInfo;
}

