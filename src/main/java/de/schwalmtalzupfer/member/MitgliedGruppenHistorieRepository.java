package de.schwalmtalzupfer.member;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface MitgliedGruppenHistorieRepository extends JpaRepository<MitgliedGruppenHistorie, UUID> {
    List<MitgliedGruppenHistorie> findByMemberIdOrderByGueltigAbDesc(UUID memberId);
}
