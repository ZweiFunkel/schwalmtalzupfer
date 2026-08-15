package de.schwalmtalzupfer.beitritt;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MembershipApplicationRepository extends JpaRepository<MembershipApplication, UUID> {
    List<MembershipApplication> findByStatusOrderByCreatedAtDesc(MembershipApplicationStatus status);
    List<MembershipApplication> findAllByOrderByCreatedAtDesc();
}
