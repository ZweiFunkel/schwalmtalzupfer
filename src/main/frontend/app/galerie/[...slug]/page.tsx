import GalerieModernView from '@/components/GalerieModernView'

// generateStaticParams() gibt [] zurück – keine Seiten werden vorgebaut.
// GalerieModernView liest den Pfad selbst via usePathname() (client-side).
// Spring Boot liefert galerie/index.html als Fallback für alle /galerie/** Pfade.
export function generateStaticParams() {
  return []
}

export default function GalerieSlugPage() {
  return <GalerieModernView />
}
