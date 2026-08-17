package de.schwalmtalzupfer.page;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PageRepository extends JpaRepository<Page, UUID> {
    Optional<Page> findBySlug(String slug);
}

