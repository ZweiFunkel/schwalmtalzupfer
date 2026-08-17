-- ============================================================
-- V1.1 – Initial Content: Seiten & Sektionen
-- ============================================================

-- ----------------------------------------------------------------
-- Seite: home
-- ----------------------------------------------------------------
INSERT INTO page (id, slug, title)
VALUES ('a1000000-0000-0000-0000-000000000001', 'home', 'Startseite');

-- HERO-Sektion
INSERT INTO page_section (id, page_id, type, position, content)
VALUES (
    'b1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    'HERO',
    1,
    '{
        "headline": "Jugendförderung Schwalmtaler Zupfer",
        "subheadline": "Musik verbindet – Gemeinschaft bewegt. Willkommen bei unserem Zupforchester.",
        "ctaLabel": "Konzerte entdecken",
        "ctaHref": "/konzerte"
    }'::jsonb
);

-- EVENT_CARD-Sektion
INSERT INTO page_section (id, page_id, type, position, content)
VALUES (
    'b1000000-0000-0000-0000-000000000002',
    'a1000000-0000-0000-0000-000000000001',
    'EVENT_CARD',
    2,
    '{
        "events": [
            {
                "title": "Großes Sommerkonzert 2026",
                "date": "28.06.2026",
                "location": "Waldnieler Marktplatz",
                "description": "Unser jährliches Sommerkonzert unter freiem Himmel – mit dem Jugendzupforchester und Ehrengästen."
            },
            {
                "title": "Herbstkonzert 2026",
                "date": "15.10.2026",
                "location": "Kulturzentrum Schwalmtal",
                "description": "Klassische und moderne Stücke, präsentiert von unseren Nachwuchsmusikern."
            },
            {
                "title": "Weihnachtskonzert 2026",
                "date": "20.12.2026",
                "location": "St. Antonius Kirche, Waldniel",
                "description": "Besinnliche Adventsklänge – Eintritt frei, Spenden willkommen."
            }
        ]
    }'::jsonb
);

-- ----------------------------------------------------------------
-- Seite: geschichte
-- ----------------------------------------------------------------
INSERT INTO page (id, slug, title)
VALUES ('a1000000-0000-0000-0000-000000000002', 'geschichte', 'Geschichte');

-- TEXT_BLOCK Teil 1
INSERT INTO page_section (id, page_id, type, position, content)
VALUES (
    'b1000000-0000-0000-0000-000000000003',
    'a1000000-0000-0000-0000-000000000002',
    'TEXT_BLOCK',
    1,
    '{
        "heading": "Unsere Geschichte",
        "markdown": "## Vom kleinen Ensemble zum Verein\n\nDie **Schwalmtaler Zupfer** wurden in den 1980er Jahren von einer Handvoll musikbegeisterter Jugendlicher und Erwachsener gegründet, die eine gemeinsame Leidenschaft für Zupfinstrumente – Gitarre, Mandoline und Laute – teilten.\n\nIn den Anfangsjahren probte die Gruppe noch in Wohnzimmern und Gemeindesälen. Der erste öffentliche Auftritt fand im Jahr 1984 auf dem Waldnieler Pfarrfest statt und begeisterte das Publikum so sehr, dass der Wunsch nach einer formellen Vereinsstruktur schnell wuchs.\n\n> *„Musik ist die Sprache, die jeder versteht."* – Gründungsmitglied Hans Müller"
    }'::jsonb
);

-- TEXT_BLOCK Teil 2
INSERT INTO page_section (id, page_id, type, position, content)
VALUES (
    'b1000000-0000-0000-0000-000000000004',
    'a1000000-0000-0000-0000-000000000002',
    'TEXT_BLOCK',
    2,
    '{
        "heading": "Jugendförderung als Herzstück",
        "markdown": "## Nachwuchs begeistern\n\nHeute zählt die **Jugendförderung** zu den wichtigsten Säulen des Vereins. Kinder und Jugendliche ab 8 Jahren erhalten die Möglichkeit, in einem liebevollen und professionellen Umfeld ein Zupfinstrument zu erlernen.\n\n### Unsere Angebote\n- **Schnupperkurse** für Einsteiger ab 8 Jahren\n- **Gruppenunterricht** in altersgemischten Ensembles\n- **Orchesterproben** jeden Freitagabend in Waldniel\n- **Konzertreisen** zu nationalen und internationalen Festivals\n\nMit über 40 Jahren Vereinsgeschichte blicken wir stolz auf Hunderte von Nachwuchsmusikern zurück, die bei uns das Zupfen erlernten und die Freude an der Musik in alle Welt getragen haben."
    }'::jsonb
);

-- ----------------------------------------------------------------
-- Seite: vorstand
-- ----------------------------------------------------------------
INSERT INTO page (id, slug, title)
VALUES ('a1000000-0000-0000-0000-000000000003', 'vorstand', 'Vorstand');

-- PERSON_GRID-Sektion
INSERT INTO page_section (id, page_id, type, position, content)
VALUES (
    'b1000000-0000-0000-0000-000000000005',
    'a1000000-0000-0000-0000-000000000003',
    'PERSON_GRID',
    1,
    '{
        "heading": "Unser Vorstand",
        "persons": [
            {
                "name": "Benjamin Münten",
                "role": "1. Vorsitzender",
                "imageUrl": "/images/vorstand/benjamin.jpg",
                "email": "benjamin.muenten@schwalmtalzupfer.de"
            },
            {
                "name": "Frank Trepte",
                "role": "2. Vorsitzender",
                "imageUrl": "/images/vorstand/frank.jpg",
                "email": "frank.trepte@schwalmtalzupfer.de"
            },
            {
                "name": "Maria Schulten",
                "role": "Kassenwartin",
                "imageUrl": "/images/vorstand/maria.jpg",
                "email": "maria.schulten@schwalmtalzupfer.de"
            },
            {
                "name": "Klaus Becker",
                "role": "Schriftführer",
                "imageUrl": "/images/vorstand/klaus.jpg",
                "email": "klaus.becker@schwalmtalzupfer.de"
            },
            {
                "name": "Sandra Wolff",
                "role": "Jugendwartin",
                "imageUrl": "/images/vorstand/sandra.jpg",
                "email": "sandra.wolff@schwalmtalzupfer.de"
            },
            {
                "name": "Thomas Heinen",
                "role": "Dirigent",
                "imageUrl": "/images/vorstand/thomas.jpg",
                "email": "thomas.heinen@schwalmtalzupfer.de"
            }
        ]
    }'::jsonb
);

-- ----------------------------------------------------------------
-- Seite: konzerte (Alias-Seite mit eigener EVENT_CARD)
-- ----------------------------------------------------------------
INSERT INTO page (id, slug, title)
VALUES ('a1000000-0000-0000-0000-000000000004', 'konzerte', 'Konzerte');

INSERT INTO page_section (id, page_id, type, position, content)
VALUES (
    'b1000000-0000-0000-0000-000000000006',
    'a1000000-0000-0000-0000-000000000004',
    'EVENT_CARD',
    1,
    '{
        "events": [
            {
                "title": "Großes Sommerkonzert 2026",
                "date": "28.06.2026",
                "location": "Waldnieler Marktplatz",
                "description": "Unser Highlight des Jahres – open air, kostenloser Eintritt."
            },
            {
                "title": "Herbstkonzert 2026",
                "date": "15.10.2026",
                "location": "Kulturzentrum Schwalmtal",
                "description": "Herbstliche Klänge für jung und alt."
            },
            {
                "title": "Weihnachtskonzert 2026",
                "date": "20.12.2026",
                "location": "St. Antonius Kirche, Waldniel",
                "description": "Adventsklänge im festlichen Ambiente."
            }
        ]
    }'::jsonb
);

