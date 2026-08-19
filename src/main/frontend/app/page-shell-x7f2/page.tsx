// Generische, statisch vorgebaute "Lade-Shell" für CMS-Seiten, deren Slug beim
// letzten Build noch nicht existierte (siehe WebConfig.java: letzter Fallback
// im PathResourceResolver liefert diese Datei statt der Startseite aus).
//
// SlugPageClient ermittelt den tatsächlichen Slug zur Laufzeit selbst aus
// usePathname() (Browser-URL bleibt beim serverseitigen Fallback unverändert),
// lädt die Seite per Client-Fetch nach und rendert sie identisch zu einer
// regulär über app/[slug]/page.tsx erzeugten Seite.
//
// Diese Route wird NIE direkt verlinkt und dient ausschließlich als
// Build-Artefakt (static export → /page-shell-x7f2.html). Der Slug
// "page-shell-x7f2" ist deshalb in app/[slug]/page.tsx als RESERVED_SLUG
// eingetragen, damit kein CMS-Seiten-Slug diese Datei beim Export überschreibt.
import SlugPageClient from '../[slug]/SlugPageClient'

export default function PageShellFallback() {
  return <SlugPageClient />
}
