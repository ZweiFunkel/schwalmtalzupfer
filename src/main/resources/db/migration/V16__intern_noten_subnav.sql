-- V16: Noten als Untermenü-Link unter Intern hinzufügen

UPDATE site_settings
SET setting_value = jsonb_set(
    setting_value::jsonb,
    '{fixedLinks}',
    jsonb_build_array(
        jsonb_build_object(
            'label',      'Intern',
            'href',       '/intern',
            'visibility', 'member',
            'items',      jsonb_build_array(
                jsonb_build_object('label', 'Noten', 'href', '/noten')
            )
        )
    )
)::text
WHERE setting_key = 'nav_config';

