package de.schwalmtalzupfer.kalender;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface KalenderTerminRepository extends JpaRepository<KalenderTermin, UUID> {

    /**
     * Alle manuell angelegten Termine, die den Zeitraum [von, bis] überschneiden
     * (mehrtägige Termine ohne End-Datum gelten als eintägig).
     */
    @Query("SELECT t FROM KalenderTermin t " +
           "WHERE t.startDatum <= :bis AND COALESCE(t.endDatum, t.startDatum) >= :von " +
           "ORDER BY t.startDatum ASC, t.uhrzeitVon ASC")
    List<KalenderTermin> findInRange(@Param("von") LocalDate von, @Param("bis") LocalDate bis);
}
