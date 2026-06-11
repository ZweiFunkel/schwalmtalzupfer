-- V23: Intern-Subnav erweitern: Videos und Merch hinzufügen, Noten → Notenarchiv umbenennen.
-- Idempotent: Intern-Eintrag wird immer mit den aktuellen Items überschrieben.

DO $$
DECLARE
    v_cfg       jsonb;
    v_links     jsonb;
    v_new_links jsonb := '[]'::jsonb;
    v_lnk       jsonb;
    v_new_intern_items jsonb := jsonb_build_array(
        jsonb_build_object('label', 'Videos',      'href', '/intern/videos'),
        jsonb_build_object('label', 'Merch',        'href', '/intern/merch'),
        jsonb_build_object('label', 'Notenarchiv',  'href', '/noten')
    );
BEGIN
    SELECT setting_value::jsonb INTO v_cfg
    FROM site_settings WHERE setting_key = 'nav_config';

    IF v_cfg IS NULL THEN
        RAISE NOTICE 'nav_config nicht gefunden – keine Änderung.';
        RETURN;
    END IF;

    RAISE NOTICE 'Aktueller nav_config: %', v_cfg;

    v_links := COALESCE(v_cfg -> 'fixedLinks', '[]'::jsonb);

    -- Intern-Eintrag mit neuen Items überschreiben, Reihenfolge und alle anderen Einträge beibehalten
    FOR v_lnk IN SELECT value FROM jsonb_array_elements(v_links) LOOP
        IF v_lnk ->> 'href' = '/intern' THEN
            v_lnk := jsonb_set(v_lnk, '{items}', v_new_intern_items);
        END IF;
        v_new_links := v_new_links || jsonb_build_array(v_lnk);
    END LOOP;

    v_cfg := jsonb_set(v_cfg, '{fixedLinks}', v_new_links);

    UPDATE site_settings
    SET setting_value = v_cfg::text
    WHERE setting_key = 'nav_config';

    RAISE NOTICE 'Intern-Subitems aktualisiert: %', v_new_links;
END $$;

