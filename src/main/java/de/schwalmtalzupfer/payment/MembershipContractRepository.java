package de.schwalmtalzupfer.payment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MembershipContractRepository extends JpaRepository<MembershipContract, UUID> {
    Optional<MembershipContract> findByMemberId(UUID memberId);
    Optional<MembershipContract> findByStripeSubscriptionId(String stripeSubscriptionId);
}
