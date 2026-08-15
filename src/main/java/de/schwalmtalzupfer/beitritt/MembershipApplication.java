package de.schwalmtalzupfer.beitritt;

import de.schwalmtalzupfer.member.Gitarrengruppe;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "membership_application")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MembershipApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "antragsteller_vorname", nullable = false)
    private String antragstellerVorname;

    @Column(name = "antragsteller_nachname", nullable = false)
    private String antragstellerNachname;

    @Column(nullable = false)
    private String email;

    @Column
    private String telefon;

    @Column(name = "fuer_kind", nullable = false)
    @Builder.Default
    private boolean fuerKind = false;

    @Column(name = "kind_vorname")
    private String kindVorname;

    @Column(name = "kind_nachname")
    private String kindNachname;

    @Column(name = "alter_jahre")
    private Integer alterJahre;

    @Column(name = "gitarren_erfahrung", columnDefinition = "TEXT")
    private String gitarrenErfahrung;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private MembershipApplicationStatus status = MembershipApplicationStatus.NEU;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "gitarrengruppe_id")
    private Gitarrengruppe gitarrengruppe;

    @Column(name = "board_notiz", columnDefinition = "TEXT")
    private String boardNotiz;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "decided_at")
    private LocalDateTime decidedAt;
}
