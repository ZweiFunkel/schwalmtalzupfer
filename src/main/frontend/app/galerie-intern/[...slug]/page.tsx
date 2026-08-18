import GalerieModernView from '@/components/GalerieModernView'

// Noch keine echten Ordner bekannt (Inhalte werden erst nach und nach hochgeladen) - "output:
// export" verlangt aber mindestens einen generierten Pfad für eine Catch-All-Route. Echte,
// noch nicht gelistete Unterpfade werden durch Spring Boot's Parent-Fallback (WebConfig) auf
// diese Shell weitergeleitet; GalerieModernView liest dann usePathname() und zeigt den
// richtigen Ordner (identisches Verhalten wie bei der öffentlichen Galerie).
export function generateStaticParams() {
  return [{ slug: ['_platzhalter'] }]
}

export default function GalerieInternSlugPage() {
  return <GalerieModernView rootPrefix="galerie-intern/" apiPath="galerie-intern" requireAuth />
}
