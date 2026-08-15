package de.schwalmtalzupfer.member;

import de.schwalmtalzupfer.pricing.PriceGroupRate;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "invitation_token")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvitationToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String token;

    @Column(nullable = false)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private MemberRole rolle = MemberRole.MEMBER;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    @Builder.Default
    private boolean used = false;

    @Column(nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /** Nur gesetzt, wenn die Einladung aus einem angenommenen Beitrittsantrag stammt. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "gitarrengruppe_id")
    private Gitarrengruppe gitarrengruppe;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "price_group_rate_id")
    private PriceGroupRate priceGroupRate;
}
