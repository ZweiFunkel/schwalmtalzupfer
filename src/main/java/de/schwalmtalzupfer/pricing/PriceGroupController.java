package de.schwalmtalzupfer.pricing;

import de.schwalmtalzupfer.payment.StripeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/pricing/groups")
@PreAuthorize("hasAnyRole('BOARD', 'ADMIN')")
@RequiredArgsConstructor
public class PriceGroupController {

    private final PriceGroupRepository priceGroupRepository;
    private final PriceGroupRateRepository priceGroupRateRepository;
    private final PriceGroupService priceGroupService;
    private final StripeService stripeService;

    @GetMapping
    public List<Map<String, Object>> list() {
        return priceGroupRepository.findAll().stream().map(this::toDto).toList();
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> create(@RequestBody CreateGroupRequest req) {
        if (req.name() == null || req.name().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Name ist Pflichtfeld"));
        }
        PriceGroup group = PriceGroup.builder()
                .name(req.name().trim())
                .description(req.description())
                .build();
        return ResponseEntity.ok(toDto(priceGroupRepository.save(group)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> delete(@PathVariable UUID id) {
        try {
            priceGroupRepository.deleteById(id);
            return ResponseEntity.noContent().build();
        } catch (DataIntegrityViolationException e) {
            return ResponseEntity.status(409).body(Map.of("error",
                    "Preisgruppe ist noch mindestens einer Unterrichtsgruppe zugewiesen und kann nicht gelöscht werden."));
        }
    }

    @PostMapping("/{id}/rates")
    public ResponseEntity<?> addRate(@PathVariable UUID id, @RequestBody CreateRateRequest req) {
        PriceGroup group = priceGroupRepository.findById(id).orElse(null);
        if (group == null) {
            return ResponseEntity.notFound().build();
        }
        if (req.amountCents() <= 0 || req.validFrom() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Betrag und Gültig-ab-Datum sind Pflichtfelder"));
        }
        PriceGroupRate rate = PriceGroupRate.builder()
                .priceGroup(group)
                .amountCents(req.amountCents())
                .validFrom(LocalDate.parse(req.validFrom()))
                .build();
        rate = priceGroupRateRepository.save(rate);

        try {
            rate.setStripePriceId(stripeService.ensureStripePrice(rate));
            rate = priceGroupRateRepository.save(rate);
        } catch (Exception e) {
            // Rate bleibt gültig, Stripe-Price wird spätestens beim ersten Vertragsabschluss nachgeholt (ensureStripePrice ist idempotent).
            log.warn("Stripe-Price für Rate {} konnte nicht angelegt werden: {}", rate.getId(), e.getMessage());
        }

        return ResponseEntity.ok(rateDto(rate));
    }

    @GetMapping("/{id}/rates")
    public List<Map<String, Object>> rates(@PathVariable UUID id) {
        return priceGroupRateRepository.findByPriceGroupIdOrderByValidFromDesc(id).stream()
                .map(this::rateDto)
                .toList();
    }

    private Map<String, Object> toDto(PriceGroup group) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", group.getId().toString());
        map.put("name", group.getName());
        map.put("description", group.getDescription());
        priceGroupService.effectiveRate(group.getId()).ifPresent(rate -> map.put("currentRate", rateDto(rate)));
        return map;
    }

    private Map<String, Object> rateDto(PriceGroupRate rate) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", rate.getId().toString());
        map.put("amountCents", rate.getAmountCents());
        map.put("validFrom", rate.getValidFrom().toString());
        map.put("createdAt", rate.getCreatedAt().toString());
        return map;
    }

    public record CreateGroupRequest(String name, String description) {}
    public record CreateRateRequest(int amountCents, String validFrom) {}
}
