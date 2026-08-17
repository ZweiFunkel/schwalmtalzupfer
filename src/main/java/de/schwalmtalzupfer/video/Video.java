package de.schwalmtalzupfer.video;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "video")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Video {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** SOMMER | WINTER | WEITERE */
    @Column(nullable = false, length = 20)
    private String category;

    /** Jahreszahl für SOMMER/WINTER, z.B. "2024" */
    @Column(length = 10)
    private String year;

    /** Wochentag für SOMMER/WINTER: Freitag | Samstag | Sonntag */
    @Column(length = 20)
    private String day;

    /** Gruppenbezeichnung für WEITERE, z.B. "Weihnachts Klüngel" */
    @Column(length = 150)
    private String subcategory;

    /** JSON-String mit Tags für WEITERE, z.B. ["2023","Waldniel"] */
    @Column(length = 500)
    private String tags;

    /** VIDEO | PLAYLIST */
    @Column(nullable = false, length = 20)
    private String type;

    /** YouTube-Video-ID oder Playlist-ID */
    @Column(name = "youtube_id", nullable = false, length = 100)
    private String youtubeId;

    @Column(nullable = false, length = 255)
    private String title;

    /** Optionales Thumbnail-Bild (R2-URL oder externer Link). Besonders für Playlists. */
    @Column(name = "thumbnail_url", length = 1000)
    private String thumbnailUrl;

    @Column(nullable = false)
    private int position;
}

