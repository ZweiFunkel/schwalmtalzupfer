package de.schwalmtalzupfer.pricing;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "price_group_rate")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PriceGroupRate {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "price_group_id", nullable = false)
    private PriceGroup priceGroup;

    @Column(name = "amount_cents", nullable = false)
    private int amountCents;

    @Column(name = "valid_from", nullable = false)
    private LocalDate validFrom;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    /** Stripe-Price-ID (Subscription-Preis) - wird bei Bedarf lazy angelegt, siehe StripeService.ensureStripePrice. */
    @Column(name = "stripe_price_id")
    private String stripePriceId;
}
