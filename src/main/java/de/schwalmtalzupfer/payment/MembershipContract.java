package de.schwalmtalzupfer.payment;

import de.schwalmtalzupfer.member.Member;
import de.schwalmtalzupfer.pricing.PriceGroupRate;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "membership_contract")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MembershipContract {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "price_group_rate_id", nullable = false)
    private PriceGroupRate priceGroupRate;

    @Column(name = "stripe_customer_id", nullable = false)
    private String stripeCustomerId;

    @Column(name = "stripe_subscription_id", nullable = false)
    private String stripeSubscriptionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private MembershipContractStatus status = MembershipContractStatus.ACTIVE;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;
}
