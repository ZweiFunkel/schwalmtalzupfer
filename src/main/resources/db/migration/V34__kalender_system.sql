-- V34: Interner Kalender (Web + App) - Termine, Unterrichts-Ausnahmen, NRW-Schulferien,
-- Benachrichtigungs-Einstellungen pro Mitglied. Ersetzt/ergänzt die bisherige
-- Termine-Ablage als JSON in Page-Sections (TERMINE_LIST) durch eine echte, abfragbare Struktur.

CREATE TABLE IF NOT EXISTS kalender_termin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titel VARCHAR(255) NOT NULL,
    kategorie VARCHAR(30) NOT NULL DEFAULT 'sonstige', -- konzert | jugend | ausflug | unterricht | sonstige
    start_datum DATE NOT NULL,
    end_datum DATE,
    uhrzeit_von TIME,
    uhrzeit_bis TIME,
    ort VARCHAR(255),
    beschreibung TEXT,
    abgesagt BOOLEAN NOT NULL DEFAULT FALSE,
    absage_grund TEXT,
    gitarrengruppe_id UUID REFERENCES gitarrengruppe(id), -- gesetzt bei automatisch erzeugten Unterrichtsterminen
    ist_unterricht BOOLEAN NOT NULL DEFAULT FALSE,
    erstellt_von UUID REFERENCES member(id),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kalender_termin_start ON kalender_termin(start_datum);
CREATE INDEX IF NOT EXISTS idx_kalender_termin_gruppe ON kalender_termin(gitarrengruppe_id);

-- "Kein Unterricht an Tag X" - sowohl manuell (z.B. Karneval) als auch aus dem Ferien-Sync erzeugt.
CREATE TABLE IF NOT EXISTS kalender_unterricht_ausnahme (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    datum DATE NOT NULL,
    grund VARCHAR(255) NOT NULL,
    gitarrengruppe_id UUID REFERENCES gitarrengruppe(id), -- NULL = gilt fuer alle Gruppen
    quelle VARCHAR(20) NOT NULL DEFAULT 'MANUELL', -- FERIEN_SYNC | MANUELL
    erstellt_von UUID REFERENCES member(id),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kalender_ausnahme_datum ON kalender_unterricht_ausnahme(datum);

-- Cache der NRW-Schulferien (extern synchronisiert, z.B. ferien-api.de), Basis fuer automatische
-- Unterrichts-Ausnahmen waehrend der Ferien.
CREATE TABLE IF NOT EXISTS schulferien (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bundesland VARCHAR(5) NOT NULL DEFAULT 'NW',
    name VARCHAR(100) NOT NULL,
    start_datum DATE NOT NULL,
    end_datum DATE NOT NULL,
    jahr INTEGER NOT NULL,
    synced_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (bundesland, name, jahr)
);

-- Pro Mitglied konfigurierbare Benachrichtigungs-Praeferenzen (App-Settings-Screen).
CREATE TABLE IF NOT EXISTS kalender_benachrichtigung_einstellung (
    member_id UUID PRIMARY KEY REFERENCES member(id) ON DELETE CASCADE,
    konzerte BOOLEAN NOT NULL DEFAULT TRUE,
    freizeiten BOOLEAN NOT NULL DEFAULT TRUE,
    unterricht_erinnerung BOOLEAN NOT NULL DEFAULT FALSE,
    push_token VARCHAR(255),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);
