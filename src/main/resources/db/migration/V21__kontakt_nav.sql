-- V21: Kontakt aus hidden-Array entfernen und als fixedLink hinzufügen.
-- Liest erst den aktuellen Zustand; Änderungen nur wenn nötig (idempotent).

DO $$
DECLARE
    v_cfg        jsonb;
    v_hidden     jsonb;
    v_links      jsonb;
    v_kontakt    jsonb := jsonb_build_object('label', 'Kontakt', 'href', '/kontakt', 'visibility', 'public');
    v_already    boolean;
BEGIN
    -- Aktuellen Wert lesen
    SELECT setting_value::jsonb INTO v_cfg
    FROM site_settings
    WHERE setting_key = 'nav_config';

    IF v_cfg IS NULL THEN
        RAISE NOTICE 'nav_config nicht gefunden – keine Änderung.';
        RETURN;
    END IF;

    RAISE NOTICE 'Aktueller nav_config: %', v_cfg;

    -- 1. "/kontakt" aus hidden entfernen (nur wenn vorhanden)
    v_hidden := COALESCE(v_cfg -> 'hidden', '[]'::jsonb);
    IF v_hidden @> '"/ kontakt"' OR v_hidden @> '"/kontakt"' THEN
        v_hidden := (
            SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
            FROM jsonb_array_elements(v_hidden) AS elem
            WHERE elem::text NOT IN ('"/kontakt"', '"/ kontakt"')
        );
        v_cfg := jsonb_set(v_cfg, '{hidden}', v_hidden);
        RAISE NOTICE 'Kontakt aus hidden entfernt. Neu: %', v_hidden;
    ELSE
        RAISE NOTICE 'Kontakt war nicht in hidden – nichts zu tun.';
    END IF;

    -- 2. Kontakt zu fixedLinks hinzufügen (nur wenn noch nicht vorhanden)
    v_links := COALESCE(v_cfg -> 'fixedLinks', '[]'::jsonb);
    SELECT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_links) AS lnk
        WHERE lnk ->> 'href' = '/kontakt'
    ) INTO v_already;

    IF NOT v_already THEN
        v_links := v_links || jsonb_build_array(v_kontakt);
        v_cfg   := jsonb_set(v_cfg, '{fixedLinks}', v_links);
        RAISE NOTICE 'Kontakt zu fixedLinks hinzugefügt.';
    ELSE
        RAISE NOTICE 'Kontakt war bereits in fixedLinks – nichts zu tun.';
    END IF;

    RAISE NOTICE 'Neuer nav_config: %', v_cfg;

    -- Speichern
    UPDATE site_settings
    SET setting_value = v_cfg::text
    WHERE setting_key = 'nav_config';
END $$;
