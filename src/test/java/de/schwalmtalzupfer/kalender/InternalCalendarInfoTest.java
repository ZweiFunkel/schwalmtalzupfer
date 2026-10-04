package de.schwalmtalzupfer.kalender;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
class InternalCalendarInfoTest {
    @Test void internalDetailsAreAvailableInCalendarButExcludedFromPublicIcs() {
        var service = new KalenderCalendarService(null, null, null, null, null);
        var termin = KalenderTermin.builder().id(UUID.randomUUID()).titel("Konzert")
            .startDatum(LocalDate.of(2026, 12, 20)).beschreibung("Public description")
            .interneInfos("PRIVATE: meet backstage at 16:00").build();
        var event = service.toEvent(termin);
        assertEquals(termin.getInterneInfos(), service.toDto(event).get("interneInfos"));
        String ics = service.buildIcs(List.of(event));
        assertTrue(ics.contains("Public description"));
        assertFalse(ics.contains("PRIVATE"));
        assertFalse(ics.contains("backstage"));
    }
}
