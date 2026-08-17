-- V25: Optionales Thumbnail-URL-Feld für Video-Einträge (besonders für Playlists)
ALTER TABLE video ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(1000);

