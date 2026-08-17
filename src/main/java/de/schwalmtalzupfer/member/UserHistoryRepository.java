package de.schwalmtalzupfer.member;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface UserHistoryRepository extends JpaRepository<UserHistory, UUID> {
    List<UserHistory> findByUserIdOrderByTimestampDesc(UUID userId);
}

