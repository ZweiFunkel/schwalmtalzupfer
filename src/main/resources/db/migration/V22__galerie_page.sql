-- V22: Galerie-CMS-Seite anlegen (falls noch nicht vorhanden) + erste Section hinzufügen.
-- Idempotent: Seite und Section werden nur erstellt wenn nicht bereits vorhanden.

DO $$
DECLARE
    v_page_id   UUID;
    v_sec_count INT;
BEGIN
    -- 1. Seite anlegen (slug muss eindeutig sein)
    INSERT INTO page (id, slug, title)
    VALUES (gen_random_uuid(), 'galerie', 'Galerie')
    ON CONFLICT (slug) DO NOTHING;

    SELECT id INTO v_page_id FROM page WHERE slug = 'galerie';

    IF v_page_id IS NULL THEN
        RAISE NOTICE 'Seite galerie konnte nicht angelegt/gefunden werden.';
        RETURN;
    END IF;

    RAISE NOTICE 'Seite galerie hat ID: %', v_page_id;

    -- 2. Section nur hinzufügen wenn die Seite noch völlig leer ist
    SELECT COUNT(*) INTO v_sec_count FROM page_section WHERE page_id = v_page_id;

    IF v_sec_count = 0 THEN
        INSERT INTO page_section (id, page_id, type, position, content) VALUES (
            gen_random_uuid(),
            v_page_id,
            'TEXT_BLOCK',
            1,
            jsonb_build_object(
                'heading', 'Galerie',
                'markdown', E'Willkommen in unserer Foto-Galerie – hier findet ihr Bilder aus über einem Jahrzehnt Vereinsleben.\n\n'
                          || E'## Ausflüge\n'
                          || E'Eindrücke aus unseren Jugendfahrten und Ausflügen:\n'
                          || E'**Allgäu** (2011, 2013) · **Frankreich** (2007, 2015, 2017) · **Kärkestour** (2008–2017) · **Ponyhof**\n\n'
                          || E'## Konzerte\n'
                          || E'**Sommerkonzerte** (2011–2016) · **Winterkonzerte** (2010–2022)\n\n'
                          || E'## Sonstiges\n'
                          || E'**CD-Aufnahme** · **Weihnachtsmarkt Waldniel**'
            )
        );
        RAISE NOTICE 'Galerie-Intro-Section (TEXT_BLOCK) hinzugefügt.';
    ELSE
        RAISE NOTICE 'Seite hat bereits % Section(s) – nichts hinzugefügt.', v_sec_count;
    END IF;
END $$;

