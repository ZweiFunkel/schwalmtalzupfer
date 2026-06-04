import React from 'react'
import { PageData } from '@/types/page'
import SectionResolver from '@/components/SectionResolver'
import PageAnchorNav from '@/components/PageAnchorNav'
import { getApiBase } from '@/lib/api'

const API_BASE = getApiBase()

export const dynamic = 'force-dynamic'

async function getPage(slug: string): Promise<PageData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/pages/${slug}`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function generateStaticParams() {
  try {
    const res = await fetch(`${API_BASE}/api/pages`)
    if (!res.ok) return [{ slug: 'home' }]
    const pages: PageData[] = await res.json()
    const params = pages.map((p) => ({ slug: p.slug }))
    return params.length > 0 ? params : [{ slug: 'home' }]
  } catch {
    return [{ slug: 'home' }]
  }
}

function slugify(text: string) {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export default async function SlugPage({ params }: { params: { slug: string } }) {
  const page = await getPage(params.slug)

  if (!page) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-center">
        <div>
          <div className="mb-4 text-6xl opacity-30">♩</div>
          <h1 className="mb-4 text-4xl font-bold text-white">Seite nicht gefunden</h1>
          <p className="text-gray-400">Die angeforderte Seite existiert nicht.</p>
          <a href="/" className="mt-6 inline-block text-green-400 hover:underline">← Zur Startseite</a>
        </div>
      </div>
    )
  }

  const sorted = [...page.sections].sort((a, b) => a.position - b.position)

  // Build anchor nav if page has ≥2 TEXT_BLOCK sections with headings
  const textBlocks = sorted.filter(
    s => s.type === 'TEXT_BLOCK' && (s.content as { heading?: string }).heading
  )
  const showAnchorNav = textBlocks.length >= 2

  // Assign anchor ids to TEXT_BLOCK sections
  let textBlockIdx = 0
  const anchorMap = new Map<string, { index: number; anchorId: string }>()
  for (const s of sorted) {
    if (s.type === 'TEXT_BLOCK') {
      const heading = (s.content as { heading?: string }).heading ?? ''
      anchorMap.set(s.id, { index: textBlockIdx, anchorId: slugify(heading) || `section-${textBlockIdx}` })
      textBlockIdx++
    }
  }

  const anchors = textBlocks.map(s => {
    const info = anchorMap.get(s.id)!
    return { id: info.anchorId, label: (s.content as { heading?: string }).heading! }
  })

  return (
    <>
      {showAnchorNav && <PageAnchorNav anchors={anchors} />}
      {sorted.map((section) => {
        const info = anchorMap.get(section.id)
        return (
          <SectionResolver
            key={section.id}
            section={section}
            index={info?.index}
            anchorId={info?.anchorId}
          />
        )
      })}
    </>
  )
}
