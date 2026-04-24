package de.schwalmtalzupfer.member;

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

    @GetMapping("/gruppen")
    @PreAuthorize("hasAnyRole('BOARD','ADMIN')")
    public List<Map<String, Object>> allGruppen() {
        return gitarrengruppeRepository.findAll().stream().map(this::toDto).toList();
    }

    @PostMapping("/gruppen")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createGruppe(@RequestBody CreateGruppeRequest req) {
        Location location = locationRepository.findById(UUID.fromString(req.locationId()))
                .orElseThrow(() -> new IllegalArgumentException("Location nicht gefunden"));
        Gitarrengruppe g = Gitarrengruppe.builder()
                .location(location)
                .vonUhrzeit(LocalTime.parse(req.vonUhrzeit()))
                .bisUhrzeit(LocalTime.parse(req.bisUhrzeit()))
                .wochentag(req.wochentag())
                .build();
        return ResponseEntity.ok(toDto(gitarrengruppeRepository.save(g)));
    }

    @DeleteMapping("/gruppen/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteGruppe(@PathVariable UUID id) {
        gitarrengruppeRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/locations")
    @PreAuthorize("hasAnyRole('BOARD','ADMIN')")
    public List<Map<String, Object>> allLocations() {
        return locationRepository.findAll().stream().map(this::locationToDto).toList();
    }

    @PostMapping("/locations")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createLocation(@RequestBody CreateLocationRequest req) {
        Location l = Location.builder().name(req.name()).adresse(req.adresse()).build();
        return ResponseEntity.ok(locationToDto(locationRepository.save(l)));
    }

    @DeleteMapping("/locations/{id}")
    @PreAuthorize("hasRole('ADMIN')")
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
        return map;
    }

    private Map<String, Object> locationToDto(Location l) {
        return Map.of(
                "id", l.getId().toString(),
                "name", l.getName(),
                "adresse", l.getAdresse() != null ? l.getAdresse() : ""
        );
    }

    public record CreateGruppeRequest(String locationId, String vonUhrzeit, String bisUhrzeit, String wochentag) {}
    public record CreateLocationRequest(String name, String adresse) {}
}

