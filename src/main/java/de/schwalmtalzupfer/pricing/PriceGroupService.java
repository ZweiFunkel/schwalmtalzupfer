package de.schwalmtalzupfer.pricing;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PriceGroupService {

    private final PriceGroupRateRepository priceGroupRateRepository;

    /** Der aktuell gültige Satz: die Rate mit dem spätesten validFrom, das nicht in der Zukunft liegt. */
    public Optional<PriceGroupRate> effectiveRate(UUID priceGroupId) {
        LocalDate today = LocalDate.now();
        return priceGroupRateRepository.findByPriceGroupIdOrderByValidFromDesc(priceGroupId).stream()
                .filter(rate -> !rate.getValidFrom().isAfter(today))
                .max(Comparator.comparing(PriceGroupRate::getValidFrom));
    }
}
