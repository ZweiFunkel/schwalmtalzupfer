# Schwalmtalzupfer – Projektkontext für Claude

## Stack
- **Frontend**: Next.js 14 App Router, TypeScript, Tailwind CSS (`darkMode: 'class'`)
- **Backend**: Java Spring Boot, Key-Value-Store `SiteSettings` (Tabelle `site_settings`)
- **Deployment**: GitHub (`ZweiFunkel/schwalmtalzupfer`) → Auto-Deploy auf `schwalmtalzupfer.de`
- **Developer-Credit**: "Website entwickelt von NOVEX Labs" im Footer (`novexlabs.de`, NICHT `novex-labs.de`)

## Wichtige Konventionen

### Datumsformat
- Immer `dd.MM.yyyy` (deutsch)
- Bereiche: `dd.MM.yyyy – dd.MM.yyyy` (En-Dash U+2013, kein normaler Bindestrich)
- Parsing immer Range-Suffix zuerst strippen: `d.replace(/(–|-)[\s\S]*/g, '').trim()`

### Dark Mode (Admin)
- `admin/layout.tsx` wrапpt alles in `<div className="dark">` → kein useEffect-Flash
- Tailwind `dark:` greift auf jedem Vorfahren mit `class="dark"` (nicht nur `<html>`)

### TypeScript-Target
- `s`-Regex-Flag NICHT verfügbar → immer `[\s\S]*` statt `.` mit `s`-Flag

## Schlüsseldateien

| Datei | Zweck |
|-------|-------|
| `src/main/frontend/app/admin/page.tsx` | Admin-UI (Tabs: Seiten, Meldungen, Termine, …) |
| `src/main/frontend/app/admin/layout.tsx` | Dark-Mode-Wrapper für Admin |
| `src/main/frontend/components/sections/TermineListSection.tsx` | Öffentliche Terminliste `/termine` |
| `src/main/frontend/components/sections/NextConcertSection.tsx` | Nächstes-Konzert-Widget (Startseite) |
| `src/main/frontend/components/sections/TermineKonzerteSection.tsx` | Konzertliste `/konzerte` |
| `src/main/frontend/components/AnnouncementBanner.tsx` | Ankündigungsbanner + Modal |
| `src/main/frontend/lib/useMeldungen.ts` | Meldungen-Hook + `isMeldungScheduledNow()` |
| `src/main/frontend/app/layout.tsx` | Root-Layout, Footer mit Developer-Credit |

## Meldungen (Ankündigungen)
- Gespeichert als JSON-Array in `site_settings` unter Key `meldungen`
- Interface `Meldung`: `{ id, text, body?, style, activeForBanner, validFrom?, validUntil?, imageUrl?, title? }`
- `validFrom`/`validUntil`: `dd.MM.yyyy` — automatische Aktivierung/Deaktivierung
- Scheduled Meldungen haben Vorrang vor manuell aktiven
- `isMeldungScheduledNow(m)` in `useMeldungen.ts` prüft ob heute im Fenster liegt

## Termine (TermineList)
- Interface `TerminItem` (Admin): `{ _key, title, date, time?, location?, note?, details?, kategorie, cancelled?, cancellationNote?, meldungId?, archivedAfter?, tickets?, parking?, mapUrl? }`
- `_key`: ephemerer UUID pro Session (NICHT gespeichert), für stabilen React-Key + expanded-State
- `date`: Single `dd.MM.yyyy` oder Range `dd.MM.yyyy – dd.MM.yyyy`
- `time`: mehrzeilig (Textarea, `\n` als Trenner für mehrere Zeiten)
- **Admin-Sortierung**: Auto-Sort nach Datum+Uhrzeit; `updateNoSort` beim Tippen, `sortNow` onBlur (verhindert DOM-Sprung)
- **Archiv**: Vergangene Termine (Ende-Datum < heute) landen im zusammenklappbaren Archiv-Bereich
- **Kategorien**: `konzert | jugend | ausflug | sonstige`

### Deeplink zu Terminen
- `terminAnchor(date, title)` in `TermineListSection.tsx` erzeugt stabilen Slug
- Jede Termin-Karte hat `id={terminAnchor(...)}` → direktes Anspringen via `#hash`
- Hash-Scroll + grüner Ring-Highlight beim Laden
- `NextConcertSection` und `TermineKonzerteSection` verlinken direkt dorthin

## Admin-UI Designprinzipien
- Sticky Topbar mit Initialen-Avatar + Underline-Tab-Nav (grüner `h-0.5`-Indikator)
- Labels: `text-[11px] font-semibold uppercase tracking-wide text-gray-500`
- Fehlende Features: Fehler sofort anzeigen, nicht verstecken
- Neue Termine: oben hinzufügen, sofort ausgeklappt, per `_key` stable
- Alle Termine standardmäßig eingeklappt

## Bekannte Fallstricke
- Range-Datum `"18.12.2026 – 20.12.2026"` mit `.split('.')` → 5 Teile, kein Jahr-Match → `Invalid Date`; Fix: immer Range-Suffix zuerst strippen
- `sortedTermine()` re-sortiered bei jedem Update → DOM-Sprung beim Tippen in Datumsfelder → `updateNoSort` + `sortNow` onBlur
- `archivedAfter`: manuelles Archivierungsdatum; `isPast(date)`: automatisch via Enddatum
