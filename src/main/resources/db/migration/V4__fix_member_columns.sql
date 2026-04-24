-- V4 – Fehlende Member-Spalten nachrüsten (idempotent)

ALTER TABLE member
    ADD COLUMN IF NOT EXISTS instrument    VARCHAR(100),
    ADD COLUMN IF NOT EXISTS name          VARCHAR(255),
    ADD COLUMN IF NOT EXISTS status        VARCHAR(50) NOT NULL DEFAULT 'ACTIVE';

