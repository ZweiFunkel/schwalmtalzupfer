-- V24: Tabelle für interne Videos/Playlisten (Sommerkonzert, Winterkonzert, Weitere Auftritte)

CREATE TABLE IF NOT EXISTS video (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    category   VARCHAR(20)  NOT NULL,        -- SOMMER | WINTER | WEITERE
    year       VARCHAR(10),                  -- Jahreszahl für SOMMER/WINTER
    day        VARCHAR(20),                  -- Freitag | Samstag | Sonntag (für SOMMER/WINTER)
    subcategory VARCHAR(150),               -- Gruppenname für WEITERE
    tags       TEXT,                         -- JSON-Array mit Tags für WEITERE
    type       VARCHAR(20)  NOT NULL,        -- VIDEO | PLAYLIST
    youtube_id VARCHAR(100) NOT NULL,
    title      VARCHAR(255) NOT NULL,
    position   INTEGER      NOT NULL DEFAULT 0
);

