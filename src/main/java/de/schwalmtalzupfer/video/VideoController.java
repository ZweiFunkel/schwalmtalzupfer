package de.schwalmtalzupfer.video;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/intern/videos")
@RequiredArgsConstructor
public class VideoController {

    private final VideoRepository videoRepository;
    
    @Value("${youtube.api.key:}")
    private String youtubeApiKey;

    /** Alle Videos abrufen – für alle angemeldeten Nutzer */
    @GetMapping
    @PreAuthorize("hasAnyRole('GUEST', 'MEMBER', 'BOARD', 'ADMIN')")
    public List<Video> getAll() {
        return videoRepository.findAllByOrderByPositionAscTitleAsc();
    }
    
    /** Playlist-Videos von YouTube abrufen */
    @GetMapping("/playlist/{playlistId}")
    @PreAuthorize("hasAnyRole('GUEST', 'MEMBER', 'BOARD', 'ADMIN')")
    public ResponseEntity<List<PlaylistItem>> getPlaylistItems(@PathVariable String playlistId) {
        System.out.println("=== Playlist Request ===");
        System.out.println("Playlist ID: " + playlistId);
        System.out.println("API Key: '" + youtubeApiKey + "' (length: " + (youtubeApiKey == null ? "null" : youtubeApiKey.length()) + ")");
        
        if (youtubeApiKey == null || youtubeApiKey.isEmpty()) {
            System.out.println("API Key is null or empty!");
            return ResponseEntity.ok(new ArrayList<>());
        }
        
        try {
            RestTemplate restTemplate = new RestTemplate();
            String url = String.format(
                "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=%s&key=%s",
                playlistId, youtubeApiKey
            );
            System.out.println("Calling YouTube API: " + url);
            
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.getForObject(url, Map.class);
            System.out.println("YouTube API Response: " + (response != null ? response.toString() : "null"));
            
            List<PlaylistItem> items = new ArrayList<>();
            
            if (response != null && response.containsKey("items")) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> itemsList = (List<Map<String, Object>>) response.get("items");
                for (Map<String, Object> item : itemsList) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> snippet = (Map<String, Object>) item.get("snippet");
                    @SuppressWarnings("unchecked")
                    Map<String, Object> resourceId = (Map<String, Object>) snippet.get("resourceId");
                    @SuppressWarnings("unchecked")
                    Map<String, Object> thumbnails = (Map<String, Object>) snippet.get("thumbnails");
                    @SuppressWarnings("unchecked")
                    Map<String, Object> defaultThumb = (Map<String, Object>) thumbnails.get("default");
                    
                    PlaylistItem playlistItem = new PlaylistItem();
                    playlistItem.setVideoId((String) resourceId.get("videoId"));
                    playlistItem.setTitle((String) snippet.get("title"));
                    playlistItem.setThumbnail((String) defaultThumb.get("url"));
                    items.add(playlistItem);
                }
            }
            
            System.out.println("Returning " + items.size() + " items");
            return ResponseEntity.ok(items);
        } catch (Exception e) {
            System.err.println("ERROR fetching playlist: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.ok(new ArrayList<>());
        }
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

