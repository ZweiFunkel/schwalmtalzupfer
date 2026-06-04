// Server Component – darf generateStaticParams exportieren.
// Das eigentliche Rendering übernimmt SlugPageClient (Client Component).
// @ts-ignore
import SlugPageClient from './SlugPageClient'
import { getApiBase } from '@/lib/api'
import { PageData } from '@/types/page'

const API_BASE = getApiBase()

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
    const params = pages.map((p) => ({ slug: p.slug }))
    return params.length > 0 ? params : fallbackSlugs()
  } catch {
    return fallbackSlugs()
  }
}

function fallbackSlugs() {
  return [
    { slug: 'home' }, { slug: 'ueberuns' }, { slug: 'geschichte' },
    { slug: 'vorstand' }, { slug: 'kontakt' }, { slug: 'termine' },
    { slug: 'konzerte' }, { slug: 'ausfluege' }, { slug: 'sponsoren' },
  ]
}

export default function SlugPage({ params }: { params: { slug: string } }) {
  return <SlugPageClient slug={params.slug} />
}
