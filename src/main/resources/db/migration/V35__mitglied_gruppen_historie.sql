-- V35: Zeitlich versionierte Gruppenzuordnung + Preis pro Mitglied (Gitarrenunterricht).
-- Ein Mitglied kann die Gitarrengruppe wechseln (z.B. älter geworden, andere Zeit) - ab wann
-- die neue Zuordnung/der neue Preis gilt, wird explizit hinterlegt. Bis zu diesem Datum bleibt
-- der bisherige Stand (Zeit/Ort/Preis) sichtbar, erst ab dem Stichtag der neue.
--
-- Bewusst KEIN Backfill aus member.gitarrengruppe_id: die aktuelle direkte Zuordnung bleibt als
-- Fallback gültig (unbekannter Preis/Stichtag), bis ein Board/Admin sie hier einmal bestätigt
-- oder ändert - das deckt sich mit dem Wunsch, auch bestehende (Alt-)Verträge hier zu erfassen.
CREATE TABLE IF NOT EXISTS mitglied_gruppen_historie (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES member(id) ON DELETE CASCADE,
    gitarrengruppe_id UUID REFERENCES gitarrengruppe(id),
    monatsbeitrag_cents INTEGER,
    gueltig_ab DATE NOT NULL,
    notiz VARCHAR(500),
    erstellt_von UUID REFERENCES member(id),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mgh_member_gueltig ON mitglied_gruppen_historie(member_id, gueltig_ab DESC);

ALTER TABLE location ADD COLUMN IF NOT EXISTS parkplatz_info VARCHAR(500);
