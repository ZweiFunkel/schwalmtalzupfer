-- V26: Home-Seite: EVENT_CARD durch TERMINE_KONZERTE (auto) ersetzen
--      Konzerte-Seite: NEXT_CONCERT auf autoFromTermine umstellen

DO $$
DECLARE
    v_home_id    UUID;
    v_konzerte_id UUID;
BEGIN
    -- ── Home: EVENT_CARD → TERMINE_KONZERTE ──────────────────────────────────
    SELECT id INTO v_home_id FROM page WHERE slug = 'home';

    DELETE FROM page_section
    WHERE page_id = v_home_id AND type = 'EVENT_CARD';

    INSERT INTO page_section (id, page_id, type, position, content) VALUES (
        gen_random_uuid(), v_home_id, 'TERMINE_KONZERTE', 2,
        jsonb_build_object(
            'heading',  'Konzerte & Veranstaltungen',
            'maxItems', 6
        )
    );

    -- ── Konzerte-Seite: NEXT_CONCERT auf autoFromTermine ────────────────────
    SELECT id INTO v_konzerte_id FROM page WHERE slug = 'konzerte';

    UPDATE page_section
    SET content = content || jsonb_build_object('autoFromTermine', true, 'events', '[]'::jsonb)
    WHERE page_id = v_konzerte_id AND type = 'NEXT_CONCERT';

END $$;
