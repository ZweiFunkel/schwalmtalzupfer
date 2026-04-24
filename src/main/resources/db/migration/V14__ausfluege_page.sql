-- V14: Ausflüge & Jugendfahrten Seite anlegen

DO $$
DECLARE
    v_page_id UUID;
BEGIN
    INSERT INTO page (id, slug, title)
    VALUES (gen_random_uuid(), 'ausfluege', 'Ausflüge & Jugendfahrten')
    ON CONFLICT (slug) DO UPDATE SET title = 'Ausflüge & Jugendfahrten';

    SELECT id INTO v_page_id FROM page WHERE slug = 'ausfluege';

    DELETE FROM page_section WHERE page_id = v_page_id;

    INSERT INTO page_section (id, page_id, type, position, content) VALUES (
        gen_random_uuid(), v_page_id, 'ACTIVITY_GRID', 1,
        jsonb_build_object(
            'heading', 'Ausflüge & Jugendfahrten',
            'intro',   'Unser besonderes Augenmerk gilt der Kinder- und Jugendförderung. Aus diesem Grund bieten wir verschiedene Ausflüge und Jugendfahrten für alle Altersklassen an, um das soziale Miteinander zu fördern und Generationen zu verbinden. Die Kosten für die Kinder- & Jugendfahrten werden zu einem größtmöglichen Teil durch Spenden finanziert. Ohne unsere Sponsoren wären diese Ausflüge nicht möglich.',
            'items',   jsonb_build_array(
                jsonb_build_object(
                    'title',       'Zelten auf dem Ponyhof Heynckes',
                    'icon',        '🏕️',
                    'accent',      'amber',
                    'targetGroup', 'Kinder 8–12 Jahre',
                    'text',        'Für alle Kinder im Alter von 8 bis 12 Jahren bieten wir einmal im Jahr ein Wochenende Zeltlager auf dem Ponyhof Heynckes in Niederkrüchten an.'
                ),
                jsonb_build_object(
                    'title',       'Freizeitfahrten nach Frankreich',
                    'icon',        '🚌',
                    'accent',      'blue',
                    'targetGroup', 'Jugendliche',
                    'text',        'Unsere Jugendlichen unternehmen einmal im Jahr eine einwöchige Fahrt nach Frankreich.'
                ),
                jsonb_build_object(
                    'title',       'Kärkestour',
                    'icon',        '🚶',
                    'accent',      'green',
                    'targetGroup', 'Erwachsene',
                    'text',        'Unsere Erwachsenen unternehmen einmal jährlich eine Kärkestour.'
                )
            )
        )
    );
END $$;

