-- V17: Member-Tabelle refaktorieren
-- instrument entfernen
ALTER TABLE member DROP COLUMN IF EXISTS instrument;

-- name-Wert in vorname übernehmen, dann name-Spalte entfernen
ALTER TABLE member ADD COLUMN IF NOT EXISTS vorname VARCHAR(100);
ALTER TABLE member ADD COLUMN IF NOT EXISTS nachname VARCHAR(100);
UPDATE member SET vorname = name WHERE name IS NOT NULL;
ALTER TABLE member DROP COLUMN IF EXISTS name;

-- Neue Felder
ALTER TABLE member ADD COLUMN IF NOT EXISTS eintrittsdatum DATE;
ALTER TABLE member ADD COLUMN IF NOT EXISTS austrittsdatum DATE;
ALTER TABLE member ADD COLUMN IF NOT EXISTS ist_aktiv BOOLEAN NOT NULL DEFAULT TRUE;

-- status-Spalte migrieren und entfernen
UPDATE member SET ist_aktiv = FALSE WHERE status = 'INACTIVE';
ALTER TABLE member DROP COLUMN IF EXISTS status;

-- InvitationToken: Rolle hinzufügen
ALTER TABLE invitation_token ADD COLUMN IF NOT EXISTS rolle VARCHAR(50) NOT NULL DEFAULT 'MEMBER';

