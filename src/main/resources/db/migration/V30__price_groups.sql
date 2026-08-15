-- V30: Preisgruppen mit historisierten Preisen ("gültig ab")
CREATE TABLE IF NOT EXISTS price_group (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS price_group_rate (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_group_id UUID NOT NULL REFERENCES price_group(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,
    valid_from DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO price_group (id, name, description)
VALUES (gen_random_uuid(), 'Standard', 'Standard-Beitrag für alle Gruppen ohne eigene Preiszuordnung')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE gitarrengruppe ADD COLUMN IF NOT EXISTS price_group_id UUID REFERENCES price_group(id);

UPDATE gitarrengruppe
SET price_group_id = (SELECT id FROM price_group WHERE name = 'Standard')
WHERE price_group_id IS NULL;

ALTER TABLE gitarrengruppe ALTER COLUMN price_group_id SET NOT NULL;
