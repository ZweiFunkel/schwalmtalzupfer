-- V12: Rebuild "konzerte" page with full content

DO $$
DECLARE
    v_page_id UUID;
BEGIN
    -- Ensure konzerte page exists
    INSERT INTO page (id, slug, title)
    VALUES (gen_random_uuid(), 'konzerte', 'Konzerte')
    ON CONFLICT (slug) DO UPDATE SET title = 'Konzerte';

    SELECT id INTO v_page_id FROM page WHERE slug = 'konzerte';

    -- Remove all old sections
    DELETE FROM page_section WHERE page_id = v_page_id;

    -- Section 1: Intro TEXT_BLOCK
    INSERT INTO page_section (id, page_id, type, position, content) VALUES (
        gen_random_uuid(), v_page_id, 'TEXT_BLOCK', 1,
        jsonb_build_object(
            'heading', 'Konzerte',
            'markdown', E'Wir, die **Jugendförderung Schwalmtalzupfer e.V.**, fördern das musikalische Talent von Kindern, Jugendlichen und Erwachsenen in der Region Schwalmtal, da wir finden, dass Musizieren wichtig für die Entwicklung in allen Altersstufen ist. Wir engagieren uns mit verschiedenen Aktivitäten:\n\nEinmal im Jahr veranstalten wir ein **Sommerkonzert**, bei dem ca. 300 Musiker zusammen auf einer Bühne das Publikum musikalisch begeistern. Bei den **Winterkonzerten** in der Achim-Besgen-Halle Waldniel stimmen wir die Zuhörer mit unseren Gitarren, begleitet von Band und Chor, auf das Weihnachtsfest ein. Wir fördern die Gemeinschaft von Kindern, Jugendlichen und Erwachsenen, indem wir gemeinsam auf der Bühne musizieren oder gemeinsame Ausflüge unternehmen.'
        )
    );

    -- Section 2: Next Concert banner
    INSERT INTO page_section (id, page_id, type, position, content) VALUES (
        gen_random_uuid(), v_page_id, 'NEXT_CONCERT', 2,
        jsonb_build_object(
            'events', jsonb_build_array(
                jsonb_build_object(
                    'title', 'Sommerkonzert 2026',
                    'date', '28.06.2026',
                    'location', 'Waldnieler Marktplatz',
                    'description', 'Unser jährliches Sommerkonzert unter freiem Himmel – mit ca. 300 Gitarristen auf der Bühne. Eintritt frei!'
                ),
                jsonb_build_object(
                    'title', 'Winterkonzert 2026',
                    'date', '13.12.2026',
                    'location', 'Achim-Besgen-Halle Waldniel',
                    'description', 'Drei Abende voller Gitarrenklänge, begleitet von Band und Chor. Stimmen Sie sich auf die Weihnachtszeit ein.'
                )
            )
        )
    );

    -- Section 3: Band
    INSERT INTO page_section (id, page_id, type, position, content) VALUES (
        gen_random_uuid(), v_page_id, 'BAND_GRID', 3,
        jsonb_build_object(
            'heading', 'Band der Schwalmtalzupfer',
            'persons', jsonb_build_array(
                jsonb_build_object('name', 'Lukas Münten',  'roles', jsonb_build_array('Keyboards & Akkordeon'), 'imageUrl', ''),
                jsonb_build_object('name', 'Person 2',      'roles', jsonb_build_array('Gitarre'),               'imageUrl', ''),
                jsonb_build_object('name', 'Person 3',      'roles', jsonb_build_array('Bass'),                  'imageUrl', ''),
                jsonb_build_object('name', 'Person 4',      'roles', jsonb_build_array('Schlagzeug'),            'imageUrl', ''),
                jsonb_build_object('name', 'Person 5',      'roles', jsonb_build_array('Gesang'),                'imageUrl', '')
            )
        )
    );

    -- Section 4: Choir
    INSERT INTO page_section (id, page_id, type, position, content) VALUES (
        gen_random_uuid(), v_page_id, 'CHOIR_LIST', 4,
        jsonb_build_object(
            'heading', 'Chor der Schwalmtalzupfer',
            'conductor', 'Lukas Münten',
            'voices', jsonb_build_array(
                jsonb_build_object('name', 'Bass',   'members', jsonb_build_array('Frank', 'Georg', 'Luca')),
                jsonb_build_object('name', 'Alt',    'members', jsonb_build_array('Anna', 'Eftemija', 'Lea', 'Leonie', 'Nina', 'Nora', 'Rebekka')),
                jsonb_build_object('name', 'Sopran', 'members', jsonb_build_array('Meike', 'Monika', 'Nicole', 'Sabrina', 'Sylvia'))
            )
        )
    );

    -- Section 5: Image + Caption
    INSERT INTO page_section (id, page_id, type, position, content) VALUES (
        gen_random_uuid(), v_page_id, 'IMAGE_CAPTION', 5,
        jsonb_build_object(
            'imageUrl', '',
            'caption', 'Chor & Band der Schwalmtalzupfer – Winterkonzert 2025',
            'altText', 'Chor und Band der Schwalmtalzupfer beim Winterkonzert 2025'
        )
    );

END $$;

