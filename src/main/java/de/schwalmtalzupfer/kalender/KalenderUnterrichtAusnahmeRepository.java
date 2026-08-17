package de.schwalmtalzupfer.kalender;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface KalenderUnterrichtAusnahmeRepository extends JpaRepository<KalenderUnterrichtAusnahme, UUID> {

    List<KalenderUnterrichtAusnahme> findByDatumBetweenOrderByDatumAsc(LocalDate von, LocalDate bis);

    List<KalenderUnterrichtAusnahme> findAllByOrderByDatumAsc();
}
