package de.schwalmtalzupfer.search;

import de.schwalmtalzupfer.page.*;
import de.schwalmtalzupfer.video.*;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SearchControllerTest {
    private final PageRepository pages = mock(PageRepository.class);
    private final VideoController videos = mock(VideoController.class);
    private final StorageSearchService storage = mock(StorageSearchService.class);
    private final de.schwalmtalzupfer.i18n.ContentTranslations translations = mock(de.schwalmtalzupfer.i18n.ContentTranslations.class);
    private final SearchController controller = new SearchController(pages, videos, storage, translations);
    @org.junit.jupiter.api.BeforeEach void prepareStorage() {
        lenient().when(translations.text(anyString())).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(translations.forContent(any())).thenReturn(Map.of());
        when(storage.documents(anyBoolean(), anyBoolean())).thenReturn(new StorageSearchService.Documents(List.of(), List.of()));
    }

    @Test void anonymousNeverQueriesVideosOrReturnsInternalOrDraftPages() {
        when(pages.findAll()).thenReturn(List.of(
            Page.builder().slug("intern").title("Dä Stär").published(true).build(),
            Page.builder().slug("entwurf").title("Dä Stär").published(false).build()));
        assertTrue(controller.search("Dä Stär", null).getBody().isEmpty());
        verifyNoInteractions(videos);
    }
    @Test void memberFindsAccentedVideoWithInternalDestinationAndNoCache() {
        when(pages.findAll()).thenReturn(List.of());
        when(videos.getAll()).thenReturn(List.of(Video.builder().type("VIDEO").title("Dä Stär").youtubeId("abc123").build()));
        var auth = new UsernamePasswordAuthenticationToken("member", "", List.of(new SimpleGrantedAuthority("ROLE_MEMBER")));
        var response = controller.search("da star", auth);
        assertEquals(1, response.getBody().size());
        assertEquals("/intern/videos?video=abc123", response.getBody().getFirst().href());
        assertEquals("no-store", response.getHeaders().getCacheControl());
    }
    @Test void chefWithoutVideoPermissionNeverQueriesVideos() {
        when(pages.findAll()).thenReturn(List.of());
        var auth = new UsernamePasswordAuthenticationToken("chef", "", List.of(new SimpleGrantedAuthority("ROLE_CHEF")));
        controller.search("Dä Stär", auth);
        verifyNoInteractions(videos);
    }
    @Test void searchesVisibleTextButNotImageUrls() {
        var section = PageSection.builder().type(SectionType.TEXT_BLOCK).content(Map.of("markdown", "Gitarren für Kinder", "imageUrl", "https://example.org/private-token")).build();
        when(pages.findAll()).thenReturn(List.of(Page.builder().slug("jugend").title("Jugend").published(true).sections(List.of(section)).build()));
        assertTrue(controller.search("Gitarren Kinder", null).getBody().stream().anyMatch(r -> r.href().equals("/jugend")));
        assertTrue(controller.search("private-token", null).getBody().isEmpty());
    }
    @Test void shortQueriesDoNotReadAnySources() {
        assertTrue(controller.search("a", null).getBody().isEmpty());
        verifyNoInteractions(pages, videos);
    }
}


