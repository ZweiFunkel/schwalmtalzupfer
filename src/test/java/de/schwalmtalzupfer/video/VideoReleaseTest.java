package de.schwalmtalzupfer.video;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class VideoReleaseTest {

    private final VideoRepository repo = mock(VideoRepository.class);
    private final VideoController controller = new VideoController(repo);

    private static LocalDateTime now() { return LocalDateTime.now(ZoneId.of("Europe/Berlin")); }

    private static Video video(String title, String youtubeId, LocalDateTime releaseAt) {
        return Video.builder().category("WINTER").year("2026").type("PLAYLIST").title(title)
                .youtubeId(youtubeId).thumbnailUrl(youtubeId == null ? null : "https://cdn/x.jpg").releaseAt(releaseAt).build();
    }

    private static Authentication as(String role) {
        return new UsernamePasswordAuthenticationToken("u", "p", List.of(new SimpleGrantedAuthority(role)));
    }

    @Test
    void membersOnlyGetATeaserBeforeTheReleaseDate() {
        Video future = video("Freitag", "PLsecret1234567", now().plusDays(3));
        Video open = video("Samstag", "PLopen123456789", now().minusDays(1));
        when(repo.findAllByOrderByPositionAscTitleAsc()).thenReturn(List.of(future, open));

        List<Video> seen = controller.getAll(as("ROLE_MEMBER"));

        Video teaser = seen.get(0);
        assertThat(teaser.isReleased()).isFalse();
        assertThat(teaser.getTitle()).isEqualTo("Freitag");
        assertThat(teaser.getYoutubeId()).isEmpty();
        assertThat(teaser.getThumbnailUrl()).isNull();
        assertThat(teaser.getReleaseAt()).isEqualTo(future.getReleaseAt());
        assertThat(seen.get(1).getYoutubeId()).isEqualTo("PLopen123456789");
        assertThat(seen.get(1).isReleased()).isTrue();
    }

    @Test
    void releaseHappensAutomaticallyOnceTheTimeHasPassed() {
        Video v = video("Sonntag", "PLabc123456789x", now().minusSeconds(5));
        assertThat(VideoController.isReleased(v)).isTrue();
        v.setReleaseAt(now().plusMinutes(1));
        assertThat(VideoController.isReleased(v)).isFalse();
    }

    @Test
    void entryWithoutLinkIsAlwaysATeaser() {
        Video v = video("Montag", null, null);
        assertThat(VideoController.isReleased(v)).isFalse();
        v.setYoutubeId("  ");
        assertThat(VideoController.isReleased(v)).isFalse();
    }

    @Test
    void boardSeesEverythingIncludingTheLink() {
        Video future = video("Freitag", "PLsecret1234567", now().plusDays(3));
        when(repo.findAllByOrderByPositionAscTitleAsc()).thenReturn(List.of(future));

        Video seen = controller.getAll(as("ROLE_BOARD")).get(0);

        assertThat(seen.getYoutubeId()).isEqualTo("PLsecret1234567");
        assertThat(seen.isReleased()).isFalse();
    }

    @Test
    void playlistContentIsNotReachableAroundTheTeaser() {
        Video future = video("Freitag", "PLsecret1234567", now().plusDays(3));
        when(repo.findAllByYoutubeId("PLsecret1234567")).thenReturn(List.of(future));
        when(repo.findAllByYoutubeId("PLunknown000000")).thenReturn(List.of());

        assertThat(controller.playlist("PLsecret1234567", as("ROLE_MEMBER")).getStatusCode().value()).isEqualTo(404);
        assertThat(controller.playlist("PLunknown000000", as("ROLE_BOARD")).getStatusCode().value()).isEqualTo(404);
    }
}
