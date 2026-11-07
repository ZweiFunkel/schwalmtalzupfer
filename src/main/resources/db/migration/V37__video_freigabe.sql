-- Videos koennen vorab als Teaser angelegt werden (ohne YouTube-Link) und werden zum Freigabezeitpunkt
-- automatisch sichtbar.
ALTER TABLE video ALTER COLUMN youtube_id DROP NOT NULL;
ALTER TABLE video ADD COLUMN IF NOT EXISTS release_at TIMESTAMP;
