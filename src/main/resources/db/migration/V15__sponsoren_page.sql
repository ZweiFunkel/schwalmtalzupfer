-- V15: Sponsoren-Seite anlegen + Nav auf neues Format aktualisieren (sponsoren als Main-Nav)

-- Nav-Config auf neues Format umstellen; sponsoren wird als extraPage direkt im Haupt-Nav angezeigt
UPDATE site_settings
SET setting_value = jsonb_build_object(
    'dropdowns', jsonb_build_array(
        jsonb_build_object(
            'label', 'Über uns',
            'target', 'geschichte',
            'items', jsonb_build_array('geschichte', 'konzerte', 'vorstand')
        ),
        jsonb_build_object(
            'label', 'Vereinsleben',
            'items', jsonb_build_array('termine', 'ausfluege')
        )
    ),
    'fixedLinks', jsonb_build_array(
        jsonb_build_object('label', 'Intern', 'href', '/intern', 'visibility', 'member')
    )
)::text
WHERE setting_key = 'nav_config';

-- Sponsoren-Seite anlegen
DO $$
DECLARE
    v_page_id UUID;
BEGIN
    INSERT INTO page (id, slug, title)
    VALUES (gen_random_uuid(), 'sponsoren', 'Sponsoren')
    ON CONFLICT (slug) DO UPDATE SET title = 'Sponsoren';

    SELECT id INTO v_page_id FROM page WHERE slug = 'sponsoren';

    DELETE FROM page_section WHERE page_id = v_page_id;

    INSERT INTO page_section (id, page_id, type, position, content) VALUES (
        gen_random_uuid(), v_page_id, 'SPONSOR_GRID', 1,
        jsonb_build_object(
            'heading', 'Unsere Sponsoren',
            'intro',   'An dieser Stelle bedanken wir uns bei den Sponsoren, ohne die die Kinder- und Jugendarbeit nicht möglich wäre!',
            'sponsors', jsonb_build_array(

                jsonb_build_object(
                    'name',    'Autohaus C.Papastathis',
                    'address', 'Stöckener Feld 9, 41366 Schwalmtal',
                    'website', 'www.autohaus-schwalmtal.de',
                    'phone',   '02163 4018'
                ),

                jsonb_build_object(
                    'name',    'Baustoffzentrum Oude Hengel GmbH',
                    'address', 'Heidweg 2, 41379 Brüggen',
                    'website', 'oudehengel.de',
                    'phone',   '02163 9570 - 0'
                ),

                jsonb_build_object(
                    'name',    'Behnke Baumpflege',
                    'address', 'Lüttelbrachter Straße 114, 41379 Brüggen',
                    'website', 'https://www.baumpflege-behnke.de/',
                    'phone',   '+49 (0)216310216'
                ),

                jsonb_build_object(
                    'name',    'Dieter Moers e.K.',
                    'address', 'Im Grund 61, 41372 Niederkrüchten',
                    'website', 'heizung-sanitaer-moers.de',
                    'phone',   '02163 81294'
                ),

                jsonb_build_object(
                    'name',    'Elektro Pickers',
                    'address', 'Holtweg 29, 41379 Brüggen',
                    'website', 'www.elektro-pickers.de',
                    'phone',   '02157 7689',
                    'mobile',  '0172 2445931'
                ),

                jsonb_build_object(
                    'name',    'Feikes Heizungs und Installations GmbH',
                    'address', 'Holtweg 43, 41379 Brüggen/Bracht',
                    'website', 'www.feikes-heizung.de',
                    'phone',   '02157 909844'
                ),

                jsonb_build_object(
                    'name',    'Fliesen Janßen',
                    'address', 'Holtweg 27, 41379 Brüggen-Bracht',
                    'website', 'www.janssen-fliesen.de',
                    'phone',   '02157 7181'
                ),

                jsonb_build_object(
                    'name',    'Fliesen Laux GmbH',
                    'address', 'Eschenrath 13A, 41366 Schwalmtal',
                    'phone',   '02163 47430'
                ),

                jsonb_build_object(
                    'name',    'Getränke Service Weuthen',
                    'address', 'Dülkener Straße 56, 41366 Schwalmtal',
                    'phone',   '02163 3903'
                ),

                jsonb_build_object(
                    'name',    'Golden Goal Sport & Flock',
                    'address', 'Hubertusplatz 21, 41334 Nettetal',
                    'website', 'https://www.golden-goal.net/',
                    'phone',   '02153 9549940'
                ),

                jsonb_build_object(
                    'name',    'Heinrich Mohren GmbH & Co. KG',
                    'address', 'Schellerstr. 31 - 33, 41366 Schwalmtal',
                    'website', 'www.heinrich-mohren.de',
                    'phone',   '02163 92630'
                ),

                jsonb_build_object(
                    'name',    'Heizung u. Sanitär Reinartz',
                    'address', 'Dülkener Straße 72, 41366 Schwalmtal',
                    'website', 'reinartz-sanitaer.de',
                    'phone',   '02163 4413'
                ),

                jsonb_build_object(
                    'name',    'HÖKE Augenoptik',
                    'address', 'Sankt-Michael-Straße 3, 41366 Schwalmtal',
                    'website', 'www.hoeke-optik.de',
                    'phone',   '02163 4035'
                ),

                jsonb_build_object(
                    'name',    'Insektenschutz Coenen GmbH',
                    'address', 'Elektronikstraße 7, 41751 Viersen',
                    'website', 'www.insektenschutz-coenen.de',
                    'phone',   '02163 3489342'
                ),

                jsonb_build_object(
                    'name',    'Jacobs Wohnbau GmbH',
                    'address', 'Hühnerkamp 2, 41366 Schwalmtal',
                    'website', 'https://www.jacobs-wohnbau.de/',
                    'phone',   '02163 88862-0'
                ),

                jsonb_build_object(
                    'name',    'KVS Von der Forst GmbH & Co. KG',
                    'address', 'Hühnerkamp 21, 41366 Schwalmtal',
                    'website', 'https://www.kvs-busreisen.de/',
                    'phone',   '02163 / 9 48 99 - 0'
                ),

                jsonb_build_object(
                    'name',    'Landmarkt Lentzen e. K.',
                    'address', 'Vogelsrather Weg 59, 41366 Schwalmtal',
                    'website', 'https://lentzen.de/',
                    'phone',   '(02163) 3197-1'
                ),

                jsonb_build_object(
                    'name',    'Mundfortz Baustoffe GmbH',
                    'address', 'Amerner Straße 49, 41366 Schwalmtal Waldniel',
                    'website', 'https://mundfortz.de/',
                    'phone',   '02163 88837 0'
                ),

                jsonb_build_object(
                    'name',    'NEW AG',
                    'address', 'Odenkirchener Straße 201, 41236 Mönchengladbach',
                    'website', 'www.new.de',
                    'phone',   '02166 688 - 0'
                ),

                jsonb_build_object(
                    'name',    'Prüfzentrum Schwalmtal Obst & Müller eGbR',
                    'address', 'Ungerath 306, 41366 Schwalmtal'
                ),

                jsonb_build_object(
                    'name',    'REWE Familie Stücken',
                    'website', 'https://www.rewe.de/',
                    'locations', jsonb_build_array(
                        jsonb_build_object(
                            'name',    'REWE Markt Amern',
                            'address', 'Hauptstr. 38a-40, 41366 Schwalmtal / Amern',
                            'phone',   '02163-4994911'
                        ),
                        jsonb_build_object(
                            'name',    'REWE Markt Niederkrüchten',
                            'address', 'Hochstr. 75, 41372 Niederkrüchten',
                            'phone',   '02163-5776615'
                        ),
                        jsonb_build_object(
                            'name',    'REWE Markt Brüggen',
                            'address', 'Borner Str. 50-52, 41379 Brüggen',
                            'phone',   '02163-5047'
                        ),
                        jsonb_build_object(
                            'name',    'REWE Markt Bracht',
                            'address', 'Kaldenkirchener Str. 6, 41379 Brüggen / Bracht',
                            'phone',   '02157-1249903'
                        )
                    )
                ),

                jsonb_build_object(
                    'name',    'SANDERS Tiefbau GmbH & Co KG',
                    'address', 'Vogelsrather Weg 11, 41366 Schwalmtal',
                    'website', 'https://www.sanders-tiefbau.de/',
                    'phone',   '02163 / 94 47 - 0'
                ),

                jsonb_build_object(
                    'name',    'Schwalmtalwerke',
                    'address', 'Haversloh 2, 41366 Schwalmtal',
                    'website', 'https://www.schwalmtalwerke.de/',
                    'phone',   '02163946300'
                ),

                jsonb_build_object(
                    'name',    'Sparkasse Krefeld',
                    'address', 'Dülkener Str. 48, 41366 Schwalmtal',
                    'website', 'www.sparkasse-krefeld.de',
                    'phone',   '02163 9563-5200'
                ),

                jsonb_build_object(
                    'name',    'Thermomix | Vorwerk',
                    'person',  'Nina Winkler',
                    'address', 'Mönchengladbach',
                    'website', 'https://www.vorwerk.com/de',
                    'phone',   '0172 7878793'
                ),

                jsonb_build_object(
                    'name',    'TUI ReiseCenter Brüggen',
                    'address', 'Borner Str. 1, 41379 Brüggen',
                    'website', 'https://www.tui-reisecenter.de',
                    'phone',   '(0 21 63) 50 21'
                ),

                jsonb_build_object(
                    'name',    'Volksbank Viersen eG',
                    'address', 'Neumarkt 6 - 6a, 41751 Viersen',
                    'website', 'www.volksbankviersen.de',
                    'phone',   '02162 4808-0'
                ),

                jsonb_build_object(
                    'name',    'VORTMANN GmbH',
                    'address', 'Hühnerkamp 19, 41366 Schwalmtal',
                    'website', 'https://vortmann-gmbh.de/',
                    'phone',   '+49 (0) 2163 94897-0'
                )

            )
        )
    );
END $$;

