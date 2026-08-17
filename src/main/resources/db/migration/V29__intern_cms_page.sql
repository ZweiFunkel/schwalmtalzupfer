-- Create the intern CMS page (for changelog and other intern sections)
INSERT INTO page (id, slug, title, published)
VALUES (gen_random_uuid(), 'intern', 'Intern', true)
ON CONFLICT (slug) DO NOTHING;

-- Add an empty INTERN_CHANGELOG section to it
INSERT INTO page_section (id, page_id, type, position, content)
SELECT gen_random_uuid(), p.id, 'INTERN_CHANGELOG', 1,
    '{"heading": "Was ist neu?", "entries": []}'::jsonb
FROM page p
WHERE p.slug = 'intern'
  AND NOT EXISTS (
    SELECT 1 FROM page_section ps
    WHERE ps.page_id = p.id AND ps.type = 'INTERN_CHANGELOG'
  );
