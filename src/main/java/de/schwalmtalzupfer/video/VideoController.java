package de.schwalmtalzupfer.video;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/intern/videos")
@RequiredArgsConstructor
public class VideoController {

    private final VideoRepository videoRepository;

    /** Alle Videos abrufen – für alle angemeldeten Nutzer */
    @GetMapping
    @PreAuthorize("hasAnyRole('GUEST', 'MEMBER', 'BOARD', 'ADMIN')")
    public List<Video> getAll() {
        return videoRepository.findAllByOrderByPositionAscTitleAsc();
    }

    /** Neues Video anlegen – nur Vorstand/Admin */
    @PostMapping
    @PreAuthorize("hasAnyRole('BOARD', 'ADMIN')")
    public ResponseEntity<Video> create(@RequestBody Video video) {
        video.setId(null);
        return ResponseEntity.ok(videoRepository.save(video));
    }

    /** Video aktualisieren – nur Vorstand/Admin */
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('BOARD', 'ADMIN')")
    public ResponseEntity<Video> update(@PathVariable UUID id, @RequestBody Video video) {
        if (!videoRepository.existsById(id)) return ResponseEntity.notFound().build();
        video.setId(id);
        return ResponseEntity.ok(videoRepository.save(video));
    }

    /** Video löschen – nur Vorstand/Admin */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('BOARD', 'ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        if (!videoRepository.existsById(id)) return ResponseEntity.notFound().build();
        videoRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}

