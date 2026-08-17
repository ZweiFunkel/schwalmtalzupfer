-- V11: Add "vorstand" as second item under "Über uns" in nav_config
UPDATE site_settings
SET setting_value = '{"ueberUns":["geschichte","vorstand"],"vereinsleben":["termine","ausfluege","jugendfahrten"]}'
WHERE setting_key = 'nav_config';

