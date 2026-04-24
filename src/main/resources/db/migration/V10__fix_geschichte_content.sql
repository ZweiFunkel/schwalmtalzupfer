-- V10: Definitively replace all content of the "geschichte" page

DO $$
DECLARE
    v_page_id UUID;
BEGIN
    -- Get the actual page id by slug
    SELECT id INTO v_page_id FROM page WHERE slug = 'geschichte';

    IF v_page_id IS NULL THEN
        RAISE EXCEPTION 'Page with slug "geschichte" not found';
    END IF;

    -- Remove ALL existing sections for this page
    DELETE FROM page_section WHERE page_id = v_page_id;

    -- Update title
    UPDATE page SET title = 'Geschichte & Leitfaden' WHERE id = v_page_id;

    -- Insert Geschichte section
    INSERT INTO page_section (id, page_id, type, position, content)
    VALUES (
        gen_random_uuid(),
        v_page_id,
        'TEXT_BLOCK',
        1,
        jsonb_build_object(
            'heading', 'Geschichte',
            'markdown', E'Gegründet im Jahr 1981 durch **Erwin Münten**, unterrichtete dieser in seiner Freizeit eine kleine Gruppe von 10 gitarrenbegeisterten Schwalmtalern.\n\nÜber die Jahre ist die Anzahl an Gitarrebegeisterten stetig gewachsen, so dass Erwin Münten im Jahr 1993 sein Hobby zum Beruf machte und von dort an bis zum Jahre 2022 zusammen mit seinem Sohn **Benjamin Münten** die Schwalmtalzupfer leitete. Seit 2023 hat Benjamin Münten die alleinige Leitung übernommen.\n\nErwin und Benny verstehen die Schwalmtalzupfer aber nicht nur als Beruf, sondern fungieren mit dem, seit 1996 eingetragenen Verein zur Jugendförderung (**Jugendförderung Schwalmtal-Zupfer e.V.**), auch als gemeinnützige Einrichtung für Jugendliche und Kinder. So findet einmal im Jahr ein Ausflug mit allen Kindern auf dem Ponyhof statt. Die Jugendlichen unternehmen alle zwei Jahre eine Jugendfahrt.\n\nNeben den Freizeitangeboten für Kinder und Jugendliche veranstalten die Schwalmtalzupfer auch zwei mal im Jahr ein großes Konzert. Im Sommer findet in der Regel ein Open-Air statt, wo sich alle Schwalmtalzupfer gleichzeitig auf der Bühne befinden. Kurz vor Weihnachten treffen sich die Schwalmtalzupfer an einem Adventswochenende, in der **Achim-Besgen-Halle**, wo an drei Tagen Konzerte statt finden. Zwischen den großen Konzerten finden dann noch mehrere Auftritte mit Kleingruppen statt.\n\nMit über 300 Gitarristen zählen die Schwalmtalzupfer als das größte und beständigste **Gitarrenorchester in Europa**.'
        )
    );

    -- Insert Leitfaden section
    INSERT INTO page_section (id, page_id, type, position, content)
    VALUES (
        gen_random_uuid(),
        v_page_id,
        'TEXT_BLOCK',
        2,
        jsonb_build_object(
            'heading', 'Leitfaden',
            'markdown', E'Liebe Mitspieler, Freunde und Interessenten,\n\nwir verstehen uns als eine Gruppe, die durch die Freude am Gitarrespielen und Singen entstanden ist. Das derzeitige und, wie wir hoffen, auch künftige Interesse an unserem gemeinsamen Arbeiten zeigt die Bedeutung von Generationen verbindendem und sozialen Miteinander, wie es sich sowohl im musikalischen Bereich als auch bei gemeinsamen Freizeitaktivitäten ausdrückt.\n\nAls Folge dieser Einstellung ergeben sich für uns nicht nur spektakuläre Aktionen (CDs, Winterkonzerte), sondern auch Auftritte mit Kleingruppen, Benefizveranstaltungen sowie Freizeitangebote an die Kinder und Jugendlichen der Schwalmtalzupfer.\n\nSchließlich hoffen wir auch für die Zukunft, daß die Freude, die wir beim gemeinsamen Musizieren erfahren, auch nach außen weitergetragen wird.\n\nIn diesem Sinne steht bei uns nicht an erster Stelle das Gitarrespielen in klassischer Ausrichtung und Perfektion, sondern zur Freude am Spielen und Singen soll auch – und dies sei unter sozialpädagogischen Aspekten bemerkt – die Entfaltungs- und Entwicklungsmöglichkeit jedes Einzelnen gefördert werden durch mitmenschlichen Umgang in einer tragfähigen Gemeinschaft.\n\n*Der Vorstand*'
        )
    );

END $$;

-- Update nav_config
UPDATE site_settings
SET setting_value = '{"ueberUns":["geschichte"],"vereinsleben":["vorstand","termine","ausfluege","jugendfahrten"]}'
WHERE setting_key = 'nav_config';

