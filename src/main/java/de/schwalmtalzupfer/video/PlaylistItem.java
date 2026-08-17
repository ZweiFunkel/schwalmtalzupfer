package de.schwalmtalzupfer.video;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlaylistItem {
    private String videoId;
    private String title;
    private String thumbnail;
}
