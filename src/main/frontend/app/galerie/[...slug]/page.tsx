import GalerieModernView from '@/components/GalerieModernView'

// Bekannte Top-Level-Galerie-Ordner vorbauen.
// Unbekannte Unterpfade werden durch Spring Boot's Parent-Fallback (WebConfig)
// auf den nächsten vorhandenen index.html weitergeleitet; GalerieModernView
// liest dann usePathname() und zeigt den richtigen Ordner.
export function generateStaticParams() {
  return [
    { slug: ['ausfluege'] },
    { slug: ['sommerkonzerte'] },
    { slug: ['winterkonzerte'] },
    { slug: ['sonstiges'] },
    { slug: ['ausfluege', 'allgaeu'] },
    { slug: ['ausfluege', 'frankreich'] },
    { slug: ['ausfluege', 'kaerkestour'] },
    { slug: ['ausfluege', 'ponyhof'] },
  ]
}

export default function GalerieSlugPage() {
  return <GalerieModernView />
}
