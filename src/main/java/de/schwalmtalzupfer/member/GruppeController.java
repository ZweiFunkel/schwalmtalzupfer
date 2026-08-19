package de.schwalmtalzupfer.member;

import de.schwalmtalzupfer.pricing.PriceGroup;
import de.schwalmtalzupfer.pricing.PriceGroupRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalTime;
import java.util.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class GruppeController {

    private final GitarrengruppeRepository gitarrengruppeRepository;
    private final LocationRepository locationRepository;
    private final PriceGroupRepository priceGroupRepository;

    @GetMapping("/gruppen")
    @PreAuthorize("hasAnyRole('BOARD','CHEF','ADMIN')")
    public List<Map<String, Object>> allGruppen() {
        return gitarrengruppeRepository.findAll().stream().map(this::toDto).toList();
    }

    @PostMapping("/gruppen")
    @PreAuthorize("hasAnyRole('CHEF','ADMIN')")
    public ResponseEntity<?> createGruppe(@RequestBody CreateGruppeRequest req) {
        Location location = locationRepository.findById(UUID.fromString(req.locationId()))
                .orElseThrow(() -> new IllegalArgumentException("Location nicht gefunden"));
        PriceGroup priceGroup = priceGroupRepository.findById(UUID.fromString(req.priceGroupId()))
                .orElseThrow(() -> new IllegalArgumentException("Preisgruppe nicht gefunden"));
        Gitarrengruppe g = Gitarrengruppe.builder()
                .location(location)
                .vonUhrzeit(LocalTime.parse(req.vonUhrzeit()))
                .bisUhrzeit(LocalTime.parse(req.bisUhrzeit()))
                .wochentag(req.wochentag())
                .priceGroup(priceGroup)
                .build();
        return ResponseEntity.ok(toDto(gitarrengruppeRepository.save(g)));
    }

    @PatchMapping("/gruppen/{id}/preisgruppe")
    @PreAuthorize("hasAnyRole('CHEF','ADMIN')")
    public ResponseEntity<?> updatePreisgruppe(@PathVariable UUID id, @RequestBody UpdatePreisgruppeRequest req) {
        Gitarrengruppe g = gitarrengruppeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Gruppe nicht gefunden"));
        PriceGroup priceGroup = priceGroupRepository.findById(UUID.fromString(req.priceGroupId()))
                .orElseThrow(() -> new IllegalArgumentException("Preisgruppe nicht gefunden"));
        g.setPriceGroup(priceGroup);
        return ResponseEntity.ok(toDto(gitarrengruppeRepository.save(g)));
    }

    @DeleteMapping("/gruppen/{id}")
    @PreAuthorize("hasAnyRole('CHEF','ADMIN')")
    public ResponseEntity<?> deleteGruppe(@PathVariable UUID id) {
        gitarrengruppeRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/locations")
    @PreAuthorize("hasAnyRole('BOARD','CHEF','ADMIN')")
    public List<Map<String, Object>> allLocations() {
        return locationRepository.findAll().stream().map(this::locationToDto).toList();
    }

    @PostMapping("/locations")
    @PreAuthorize("hasAnyRole('CHEF','ADMIN')")
    public ResponseEntity<?> createLocation(@RequestBody CreateLocationRequest req) {
        Location l = Location.builder().name(req.name()).adresse(req.adresse()).parkplatzInfo(req.parkplatzInfo()).build();
        return ResponseEntity.ok(locationToDto(locationRepository.save(l)));
    }

    /** Adresse/Parkplatz-Hinweis einer Location ändern (BOARD/CHEF/ADMIN). */
    @PatchMapping("/locations/{id}")
    @PreAuthorize("hasAnyRole('BOARD','CHEF','ADMIN')")
    public ResponseEntity<?> updateLocation(@PathVariable UUID id, @RequestBody UpdateLocationRequest req) {
        Location l = locationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Location nicht gefunden"));
        if (req.name() != null) l.setName(req.name());
        if (req.adresse() != null) l.setAdresse(req.adresse());
        if (req.parkplatzInfo() != null) l.setParkplatzInfo(req.parkplatzInfo());
        return ResponseEntity.ok(locationToDto(locationRepository.save(l)));
    }

    @DeleteMapping("/locations/{id}")
    @PreAuthorize("hasAnyRole('CHEF','ADMIN')")
    public ResponseEntity<?> deleteLocation(@PathVariable UUID id) {
        locationRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private Map<String, Object> toDto(Gitarrengruppe g) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", g.getId().toString());
        map.put("wochentag", g.getWochentag());
        map.put("vonUhrzeit", g.getVonUhrzeit().toString());
        map.put("bisUhrzeit", g.getBisUhrzeit().toString());
        if (g.getLocation() != null) {
            map.put("location", locationToDto(g.getLocation()));
        }
        if (g.getPriceGroup() != null) {
            map.put("priceGroup", Map.of("id", g.getPriceGroup().getId().toString(), "name", g.getPriceGroup().getName()));
        }
        return map;
    }

    private Map<String, Object> locationToDto(Location l) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", l.getId().toString());
        map.put("name", l.getName());
        map.put("adresse", l.getAdresse() != null ? l.getAdresse() : "");
        map.put("parkplatzInfo", l.getParkplatzInfo() != null ? l.getParkplatzInfo() : "");
        return map;
    }

    public record CreateGruppeRequest(String locationId, String vonUhrzeit, String bisUhrzeit, String wochentag, String priceGroupId) {}
    public record CreateLocationRequest(String name, String adresse, String parkplatzInfo) {}
    public record UpdateLocationRequest(String name, String adresse, String parkplatzInfo) {}
    public record UpdatePreisgruppeRequest(String priceGroupId) {}
}

