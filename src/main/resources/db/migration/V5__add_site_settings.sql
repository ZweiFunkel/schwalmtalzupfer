-- V5: Add site_settings table for website-wide configuration
CREATE TABLE IF NOT EXISTS site_settings (
    id BIGINT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default logo
INSERT INTO site_settings (id, setting_key, setting_value) 
VALUES (1, 'logo_url', '/assets/logo.png')
ON CONFLICT (id) DO NOTHING;

-- Insert default noten_prefix (R2-Ordner für Noten)
INSERT INTO site_settings (id, setting_key, setting_value)
VALUES (2, 'noten_prefix', 'Noten/')
ON CONFLICT (id) DO NOTHING;
