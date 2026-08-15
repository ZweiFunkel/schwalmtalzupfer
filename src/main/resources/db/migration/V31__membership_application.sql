-- V31: Beitrittsanträge
CREATE TABLE IF NOT EXISTS membership_application (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    antragsteller_vorname VARCHAR(100) NOT NULL,
    antragsteller_nachname VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    telefon VARCHAR(50),
    fuer_kind BOOLEAN NOT NULL DEFAULT FALSE,
    kind_vorname VARCHAR(100),
    kind_nachname VARCHAR(100),
    alter_jahre INTEGER,
    gitarren_erfahrung TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'NEU',
    gitarrengruppe_id UUID REFERENCES gitarrengruppe(id),
    board_notiz TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    decided_at TIMESTAMP
);
