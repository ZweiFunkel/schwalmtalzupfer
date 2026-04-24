-- V3 – Erweiterte Member-Felder + neue Rollen

ALTER TABLE member
    ADD COLUMN IF NOT EXISTS name          VARCHAR(255),
    ADD COLUMN IF NOT EXISTS instrument    VARCHAR(100),
    ADD COLUMN IF NOT EXISTS status        VARCHAR(50)  NOT NULL DEFAULT 'ACTIVE';

-- Neue Rolle GUEST, BOARD (VARCHAR, kein DDL-Constraint nötig – Enum in Java)

-- Gast-Benutzer (zupfer / zupfer → BCrypt Hash)
INSERT INTO member (id, email, password_hash, name, role, status)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'zupfer@intern',
    '$2a$12$tK1JgWPZPmTSqBEGLcX0.u.wf14m0kW5vHrSGNbRq3xSVq2f5vl8.',
    'Gast',
    'GUEST',
    'ACTIVE'
)
ON CONFLICT (email) DO NOTHING;

-- Standard-Admin (admin@schwalmtalzupfer.de / admin1234)
INSERT INTO member (id, email, password_hash, name, role, status)
VALUES (
    'c0000000-0000-0000-0000-000000000002',
    'admin@schwalmtalzupfer.de',
    '$2a$12$9WtFXiWGYhwVJQiJ3xKmCOG1LGc5JB9t.6H23CJXwIX79BpD8Knm2',
    'Administrator',
    'ADMIN',
    'ACTIVE'
)
ON CONFLICT (email) DO NOTHING;

