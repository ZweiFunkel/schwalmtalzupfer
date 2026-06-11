-- V27: Duplikat-TERMINE_KONZERTE auf Home entfernen, EVENT_CARD sicherstellen weg
DO $$
DECLARE v_home_id UUID;
BEGIN
    SELECT id INTO v_home_id FROM page WHERE slug = 'home';

    -- Behalte nur die erste TERMINE_KONZERTE-Sektion (niedrigste Position)
    DELETE FROM page_section
    WHERE page_id = v_home_id
      AND type = 'TERMINE_KONZERTE'
      AND id NOT IN (
          SELECT id FROM page_section
          WHERE page_id = v_home_id AND type = 'TERMINE_KONZERTE'
          ORDER BY position ASC
          LIMIT 1
      );

    -- EVENT_CARD sicherheitshalber nochmal entfernen
    DELETE FROM page_section WHERE page_id = v_home_id AND type = 'EVENT_CARD';
END $$;
