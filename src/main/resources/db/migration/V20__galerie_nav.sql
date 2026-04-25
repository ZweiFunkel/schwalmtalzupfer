-- V20: Galerie als fixedLink in nav_config einfügen (vor Intern).
-- Liest erst den aktuellen Zustand; fügt Galerie nur ein wenn noch nicht vorhanden.

DO $$
DECLARE
    v_cfg     jsonb;
    v_links   jsonb;
    v_already boolean;
    v_galerie jsonb := jsonb_build_object('label', 'Galerie', 'href', '/galerie', 'visibility', 'public');
BEGIN
    SELECT setting_value::jsonb INTO v_cfg
    FROM site_settings
    WHERE setting_key = 'nav_config';

    IF v_cfg IS NULL THEN
        RAISE NOTICE 'nav_config nicht gefunden – keine Änderung.';
        RETURN;
    END IF;

    RAISE NOTICE 'Aktueller nav_config: %', v_cfg;

    v_links := COALESCE(v_cfg -> 'fixedLinks', '[]'::jsonb);

    SELECT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_links) AS lnk
        WHERE lnk ->> 'href' = '/galerie'
    ) INTO v_already;

    IF NOT v_already THEN
        -- Galerie VOR alle bestehenden fixedLinks setzen
        v_links := jsonb_build_array(v_galerie) || v_links;
        v_cfg   := jsonb_set(v_cfg, '{fixedLinks}', v_links);
        RAISE NOTICE 'Galerie zu fixedLinks hinzugefügt. Neu: %', v_links;

        UPDATE site_settings
        SET setting_value = v_cfg::text
        WHERE setting_key = 'nav_config';
    ELSE
        RAISE NOTICE 'Galerie war bereits in fixedLinks – keine Änderung.';
    END IF;
END $$;
