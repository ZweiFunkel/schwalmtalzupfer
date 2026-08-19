// Server Component – darf generateStaticParams exportieren.
// Das eigentliche Rendering übernimmt SlugPageClient (Client Component).
// @ts-ignore
import SlugPageClient from './SlugPageClient'
import { getApiBase } from '@/lib/api'
import { PageData } from '@/types/page'

const API_BASE = getApiBase()

// Routen mit eigenem app/<name>/page.tsx – nicht über [slug] statisch exportieren,
// sonst überschreibt der CMS-Slug die dedizierte Seite im Production-Build.
// 'page-shell-x7f2' ist die generische Lade-Shell für WebConfig.java's
// PathResourceResolver-Fallback (unbekannte Slugs) – siehe app/page-shell-x7f2/page.tsx.
const RESERVED_SLUGS = new Set([
  'galerie', 'intern', 'kontakt', 'login', 'register', 'admin',
  'impressum', 'noten', 'profil', 'page-shell-x7f2',
])

function filterReservedSlugs(slugs: { slug: string }[]) {
  return slugs.filter((entry) => !RESERVED_SLUGS.has(entry.slug))
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  try {
    const res = await fetch(`${API_BASE}/api/pages/${params.slug}`)
    if (!res.ok) return {}
    const page: PageData = await res.json()
    return { title: page.title }
  } catch {
    return {}
  }
}

export async function generateStaticParams() {
  try {
    const res = await fetch(`${API_BASE}/api/pages`)
    if (!res.ok) throw new Error()
    const pages: PageData[] = await res.json()
    const params = filterReservedSlugs(pages.map((p) => ({ slug: p.slug })))
    return params.length > 0 ? params : fallbackSlugs()
  } catch {
    return fallbackSlugs()
  }
}

function fallbackSlugs() {
  return filterReservedSlugs([
    { slug: 'home' }, { slug: 'ueberuns' }, { slug: 'geschichte' },
    { slug: 'vorstand' }, { slug: 'termine' },
    { slug: 'konzerte' }, { slug: 'ausfluege' }, { slug: 'sponsoren' },
  ])
}

export default function SlugPage({ params }: { params: { slug: string } }) {
  return <SlugPageClient slug={params.slug} />
}
