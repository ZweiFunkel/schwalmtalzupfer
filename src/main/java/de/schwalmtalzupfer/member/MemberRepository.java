package de.schwalmtalzupfer.member;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MemberRepository extends JpaRepository<Member, UUID> {
    Optional<Member> findByEmail(String email);
    Optional<Member> findByUsername(String username);
    Optional<Member> findByEmailIgnoreCase(String email);
    Optional<Member> findByUsernameIgnoreCase(String username);
    boolean existsByEmail(String email);
    boolean existsByUsername(String username);

    @Query("SELECT m FROM Member m WHERE " +
           "(:search IS NULL OR :search = '' OR " +
           "LOWER(m.vorname) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(m.nachname) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(m.username) LIKE LOWER(CONCAT('%', :search, '%')))")
    List<Member> searchMembers(@Param("search") String search);
}
