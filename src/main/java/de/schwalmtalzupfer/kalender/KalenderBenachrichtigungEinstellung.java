package de.schwalmtalzupfer.kalender;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Pro-Mitglied konfigurierbare Benachrichtigungs-Präferenzen (App-Settings-Screen).
 * Primärschlüssel = member_id (shared PK, kein eigener Generator - wird beim Anlegen
 * manuell auf die Member-Id gesetzt).
 */
@Entity
@Table(name = "kalender_benachrichtigung_einstellung")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KalenderBenachrichtigungEinstellung {

    @Id
    @Column(name = "member_id")
    private UUID memberId;

    @Column(nullable = false)
    @Builder.Default
    private boolean konzerte = true;

    @Column(nullable = false)
    @Builder.Default
    private boolean freizeiten = true;

    @Column(name = "unterricht_erinnerung", nullable = false)
    @Builder.Default
    private boolean unterrichtErinnerung = false;

    @Column(name = "push_token")
    private String pushToken;

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();
}
