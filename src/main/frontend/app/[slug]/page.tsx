'use client'
import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PageData } from '@/types/page'
import SectionResolver from '@/components/SectionResolver'
import PageAnchorNav from '@/components/PageAnchorNav'
import { getApiBase } from '@/lib/api'

const API_BASE = getApiBase()

// generateStaticParams: Versucht alle Seiten-Slugs vom Backend zu holen.
// Schlägt fehl (API nicht erreichbar beim Build) → Fallback auf bekannte Slugs.
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

function slugify(text: string) {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export default function SlugPage() {
  const params = useParams()
  const slug = Array.isArray(params?.slug) ? params.slug[0] : (params?.slug ?? '')
  const [page, setPage]       = useState<PageData | null | undefined>(undefined)

  useEffect(() => {
    if (!slug) return
    fetch(`${API_BASE}/api/pages/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(setPage)
      .catch(() => setPage(null))
  }, [slug])

  // Laden
  if (page === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="animate-pulse text-gray-400">Lade…</div>
      </div>
    )
  }

  // Nicht gefunden
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

  const textBlocks = sorted.filter(
    s => s.type === 'TEXT_BLOCK' && (s.content as { heading?: string }).heading
  )
  const showAnchorNav = textBlocks.length >= 2

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
