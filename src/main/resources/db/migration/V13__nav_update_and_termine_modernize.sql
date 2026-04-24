-- V13: Update nav_config (konzerte unter Über uns, termine unter Vereinsleben) + Termine-Seite modernisieren

-- Update nav_config
UPDATE site_settings
SET setting_value = '{"ueberUns":["geschichte","konzerte","vorstand"],"vereinsleben":["termine","ausfluege","jugendfahrten"]}'
WHERE setting_key = 'nav_config';

-- Rebuild termine page with modern TERMINE_LIST section
DO $$
DECLARE
    v_page_id UUID;
BEGIN
    INSERT INTO page (id, slug, title)
    VALUES (gen_random_uuid(), 'termine', 'Termine')
    ON CONFLICT (slug) DO UPDATE SET title = 'Termine';

    SELECT id INTO v_page_id FROM page WHERE slug = 'termine';

    DELETE FROM page_section WHERE page_id = v_page_id;

    INSERT INTO page_section (id, page_id, type, position, content) VALUES (
        gen_random_uuid(), v_page_id, 'TERMINE_LIST', 1,
        jsonb_build_object(
            'heading', 'Unsere Termine',
            'year', '2026',
            'termine', jsonb_build_array(
                jsonb_build_object(
                    'title',     'Sommerkonzert 2026',
                    'date',      '28.06.2026',
                    'time',      '16:00 Uhr',
                    'location',  'Waldniel Marktplatz',
                    'note',      '',
                    'kategorie', 'konzert'
                ),
                jsonb_build_object(
                    'title',     'Ponyhof Zeltlager',
                    'date',      '10.07. – 12.07.2026',
                    'time',      '',
                    'location',  'Ponyhof Heynkes',
                    'note',      '',
                    'kategorie', 'jugend'
                ),
                jsonb_build_object(
                    'title',     'Kärkestour',
                    'date',      '26.09.2026',
                    'time',      '',
                    'location',  '',
                    'note',      '',
                    'kategorie', 'ausflug'
                ),
                jsonb_build_object(
                    'title',     'Jugendfahrt Südfrankreich',
                    'date',      '16.10. – 25.10.2026',
                    'time',      '',
                    'location',  'Südfrankreich',
                    'note',      '',
                    'kategorie', 'jugend'
                ),
                jsonb_build_object(
                    'title',     'Winterkonzerte 2026',
                    'date',      '18.12. – 20.12.2026',
                    'time',      '',
                    'location',  'Achim-Besgen-Halle Waldniel',
                    'note',      'Infos folgen!',
                    'kategorie', 'konzert'
                )
            )
        )
    );
END $$;

