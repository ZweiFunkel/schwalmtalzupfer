package de.schwalmtalzupfer.member;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "member")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true)
    private String username;

    @Column(unique = true)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Column
    private String vorname;

    @Column
    private String nachname;

    @Convert(converter = IbanConverter.class)
    @Column(name = "iban_encrypted")
    private String iban;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private MemberRole role = MemberRole.MEMBER;

    @Column
    private LocalDate eintrittsdatum;

    @Column
    private LocalDate austrittsdatum;

    @Column(nullable = false)
    @Builder.Default
    private boolean istAktiv = true;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "gitarrengruppe_id")
    private Gitarrengruppe gitarrengruppe;

    @Column(nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();
}
