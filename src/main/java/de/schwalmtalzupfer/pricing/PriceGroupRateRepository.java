package de.schwalmtalzupfer.pricing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PriceGroupRateRepository extends JpaRepository<PriceGroupRate, UUID> {
    List<PriceGroupRate> findByPriceGroupIdOrderByValidFromDesc(UUID priceGroupId);
}
