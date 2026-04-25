import type { Metadata } from 'next'
import React from 'react'
import { PageData } from '@/types/page'
import SectionResolver from '@/components/SectionResolver'
import GalerieModernView from '@/components/GalerieModernView'
import { getApiBase } from '@/lib/api'

const API_BASE = getApiBase()

export const metadata: Metadata = {
  title: 'Galerie – Schwalmtalzupfer',
  description: 'Fotogalerie des Schwalmtalzupfer e.V. – Konzerte, Ausflüge und mehr.',
}

async function getGaleriePage(): Promise<PageData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/pages/galerie`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function GaleriePage() {
  const page = await getGaleriePage()
  const sections = page ? [...page.sections].sort((a, b) => a.position - b.position) : []

  return (
    <>
      {/* CMS-Sections (editierbar im Admin – z.B. Intro-Text, Hero) */}
      {sections.map(section => (
        <SectionResolver key={section.id} section={section} />
      ))}
      {/* Moderne Single-Page-Galerie */}
      <GalerieModernView />
    </>
  )
}
