-- V19: UserHistory-Tabelle
CREATE TABLE IF NOT EXISTS user_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    aenderungs_typ VARCHAR(100) NOT NULL,
    alter_wert TEXT,
    neuer_wert TEXT,
    timestamp TIMESTAMP NOT NULL DEFAULT now()
);

