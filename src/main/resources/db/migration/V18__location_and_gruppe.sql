-- V18: Location und Gitarrengruppe anlegen
CREATE TABLE IF NOT EXISTS location (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    adresse VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS gitarrengruppe (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID REFERENCES location(id),
    von_uhrzeit TIME NOT NULL,
    bis_uhrzeit TIME NOT NULL,
    wochentag VARCHAR(20) NOT NULL
);

-- Fremdschlüssel in member
ALTER TABLE member ADD COLUMN IF NOT EXISTS gitarrengruppe_id UUID REFERENCES gitarrengruppe(id);

