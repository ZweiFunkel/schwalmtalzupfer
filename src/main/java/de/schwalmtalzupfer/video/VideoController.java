package de.schwalmtalzupfer.video;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/intern/videos")
@RequiredArgsConstructor
public class VideoController {

    private final VideoRepository videoRepository;
    
    @Value("${youtube.api.key:}")
    private String youtubeApiKey;

    // Cache: playlistId → (timestamp, items); TTL 1 Stunde
    private final ConcurrentHashMap<String, Object[]> playlistCache = new ConcurrentHashMap<>();
    private static final long CACHE_TTL_MS = 60 * 60 * 1000L;

    /** Alle Videos abrufen – für alle angemeldeten Nutzer */
    @GetMapping
    @PreAuthorize("hasAnyRole('GUEST', 'MEMBER', 'BOARD', 'ADMIN')")
    public List<Video> getAll() {
        return videoRepository.findAllByOrderByPositionAscTitleAsc();
    }
    
    /** Playlist-Videos von YouTube abrufen (mit 1h Cache) */
    @GetMapping("/playlist/{playlistId}")
    @PreAuthorize("hasAnyRole('GUEST', 'MEMBER', 'BOARD', 'ADMIN')")
    public ResponseEntity<List<PlaylistItem>> getPlaylistItems(@PathVariable String playlistId) {
        // Cache prüfen
        Object[] cached = playlistCache.get(playlistId);
        if (cached != null) {
            long cachedAt = (long) cached[0];
            if (Instant.now().toEpochMilli() - cachedAt < CACHE_TTL_MS) {
                @SuppressWarnings("unchecked")
                List<PlaylistItem> cachedItems = (List<PlaylistItem>) cached[1];
                System.out.println("Cache hit for playlist: " + playlistId + " (" + cachedItems.size() + " items)");
                return ResponseEntity.ok(cachedItems);
            }
            playlistCache.remove(playlistId);
        }

        System.out.println("=== Playlist Request (cache miss) ===");
        System.out.println("Playlist ID: " + playlistId);
        System.out.println("API Key length: " + (youtubeApiKey == null ? "null" : youtubeApiKey.length()));

        if (youtubeApiKey == null || youtubeApiKey.isEmpty()) {
            System.out.println("API Key is null or empty – returning empty list");
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
                    try {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> snippet = (Map<String, Object>) item.get("snippet");
                        if (snippet == null) continue;
                        @SuppressWarnings("unchecked")
                        Map<String, Object> resourceId = (Map<String, Object>) snippet.get("resourceId");
                        if (resourceId == null) continue;
                        String videoId = (String) resourceId.get("videoId");
                        if (videoId == null || videoId.isBlank()) continue;

                        // Skip deleted/private videos ("Deleted video" / "Private video")
                        String title = (String) snippet.get("title");
                        if (title == null || title.equals("Deleted video") || title.equals("Private video")) continue;

                        @SuppressWarnings("unchecked")
                        Map<String, Object> thumbnails = (Map<String, Object>) snippet.get("thumbnails");
                        String thumbUrl = null;
                        if (thumbnails != null) {
                            for (String size : new String[]{"medium", "default", "high", "standard", "maxres"}) {
                                @SuppressWarnings("unchecked")
                                Map<String, Object> t = (Map<String, Object>) thumbnails.get(size);
                                if (t != null && t.get("url") != null) {
                                    thumbUrl = (String) t.get("url");
                                    break;
                                }
                            }
                        }
                        // Fallback: YouTube thumbnail URL by video ID
                        if (thumbUrl == null) {
                            thumbUrl = "https://img.youtube.com/vi/" + videoId + "/mqdefault.jpg";
                        }

                        PlaylistItem playlistItem = new PlaylistItem();
                        playlistItem.setVideoId(videoId);
                        playlistItem.setTitle(title);
                        playlistItem.setThumbnail(thumbUrl);
                        items.add(playlistItem);
                    } catch (Exception itemEx) {
                        System.err.println("Skipping playlist item due to error: " + itemEx.getMessage());
                    }
                }
            }
            
            System.out.println("Returning " + items.size() + " items");
            // Ergebnis cachen (auch leere Liste, um wiederholte API-Calls bei privaten Playlists zu vermeiden)
            playlistCache.put(playlistId, new Object[]{Instant.now().toEpochMilli(), items});
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

