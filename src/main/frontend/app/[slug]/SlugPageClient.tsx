'use client'

import React, { useEffect, useState } from 'react'
import { PageData } from '@/types/page'
import { getApiBase } from '@/lib/api'
import { usePageLoad } from '@/lib/AppLoadingContext'
import SectionResolver from '@/components/SectionResolver'
import PageAnchorNav from '@/components/PageAnchorNav'

const API_BASE = getApiBase()

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export default function SlugPageClient({ slug }: { slug: string }) {
  const [page, setPage] = useState<PageData | null | undefined>(undefined)
  const pageDone = usePageLoad('slug-page')

  useEffect(() => {
    if (!slug) return
    fetch(API_BASE + '/api/pages/' + slug)
      .then(r => (r.ok ? r.json() : null))
      .then(data => { setPage(data); pageDone() })
      .catch(() => { setPage(null); pageDone() })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  if (page === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="animate-pulse text-gray-400">Lade...</div>
      </div>
    )
  }

  if (!page) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-center">
        <div>
          <h1 className="mb-4 text-4xl font-bold text-white">Seite nicht gefunden</h1>
          <p className="text-gray-400">Die angeforderte Seite existiert nicht.</p>
          <a href="/" className="mt-6 inline-block text-green-400 hover:underline">
            Zur Startseite
          </a>
        </div>
      </div>
    )
  }

  const sorted = [...page.sections].sort((a, b) => a.position - b.position)

  const textBlocks = sorted.filter(
    s => s.type === 'TEXT_BLOCK' && (s.content as { heading?: string }).heading,
  )
  const showAnchorNav = textBlocks.length >= 2

  let textBlockIdx = 0
  const anchorMap = new Map<string, { index: number; anchorId: string }>()
  for (const s of sorted) {
    if (s.type === 'TEXT_BLOCK') {
      const heading = (s.content as { heading?: string }).heading ?? ''
      anchorMap.set(s.id, {
        index: textBlockIdx,
        anchorId: slugify(heading) || 'section-' + textBlockIdx,
      })
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
      {sorted.map(section => {
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

