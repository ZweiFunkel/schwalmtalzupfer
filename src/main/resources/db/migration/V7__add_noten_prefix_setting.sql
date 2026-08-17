-- V7: Add noten_prefix to site_settings
INSERT INTO site_settings (id, setting_key, setting_value)
VALUES (2, 'noten_prefix', 'Noten/')
ON CONFLICT (setting_key) DO NOTHING;

