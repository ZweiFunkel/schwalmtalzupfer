import React from 'react'
import { PageData } from '@/types/page'
import SectionResolver from '@/components/SectionResolver'
import { getApiBase } from '@/lib/api'

const API_BASE = getApiBase()

async function getHomePage(): Promise<PageData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/pages/home`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function HomePage() {
  const page = await getHomePage()

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

