'use client'

import React, { useEffect, useState } from 'react'
import { PageData } from '@/types/page'
import SectionResolver from '@/components/SectionResolver'
import { getApiBase } from '@/lib/api'
import { usePageLoad } from '@/lib/AppLoadingContext'

const API_BASE = getApiBase()

export default function HomePage() {
  const [page, setPage] = useState<PageData | null | undefined>(undefined)
  const pageDone = usePageLoad('home-page')

  useEffect(() => {
    document.title = 'Schwalmtalzupfer'
    fetch(`${API_BASE}/api/pages/home`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => { setPage(data); pageDone() })
      .catch(() => { setPage(null); pageDone() })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (page === undefined) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="animate-pulse text-gray-400 text-lg">Lade…</div>
      </div>
    )
  }

  if (!page) {
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center text-center">
        <div className="mb-6 text-8xl opacity-20">𝄞</div>
        <h1 className="mb-4 text-5xl font-extrabold text-white">
          Schwalmtalzupfer
        </h1>
        <p className="text-xl text-gray-400">
          Willkommen auf der Vereinswebsite. Inhalte werden geladen…
        </p>
      </div>
    )
  }

  return (
    <>
      {page.sections
        .sort((a, b) => a.position - b.position)
        .map((section) => (
          <SectionResolver key={section.id} section={section} />
        ))}
    </>
  )
}
