package de.schwalmtalzupfer.kalender;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SchulferienRepository extends JpaRepository<Schulferien, UUID> {

    Optional<Schulferien> findByBundeslandAndNameAndJahr(String bundesland, String name, Integer jahr);

    /**
     * Alle Ferien-Ranges, die den Zeitraum [von, bis] überschneiden.
     * Achtung Parameterreihenfolge (folgt den Property-Namen in der Methode):
     * startDatum &lt;= bis AND endDatum &gt;= von.
     */
    List<Schulferien> findByStartDatumLessThanEqualAndEndDatumGreaterThanEqual(LocalDate bis, LocalDate von);
}
