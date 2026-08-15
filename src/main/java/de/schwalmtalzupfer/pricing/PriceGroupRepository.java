package de.schwalmtalzupfer.pricing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PriceGroupRepository extends JpaRepository<PriceGroup, UUID> {
    Optional<PriceGroup> findByName(String name);
}
