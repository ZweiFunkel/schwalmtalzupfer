'use client'

import React, { useEffect, useState } from 'react'
import { PageData } from '@/types/page'
import SectionResolver from '@/components/SectionResolver'
import GalerieModernView from '@/components/GalerieModernView'
import { getApiBase } from '@/lib/api'

const API_BASE = getApiBase()

export default function GaleriePage() {
  const [sections, setSections] = useState<PageData['sections']>([])

  useEffect(() => {
    fetch(`${API_BASE}/api/pages/galerie`)
      .then(r => r.ok ? r.json() : null)
      .then((page: PageData | null) => {
        if (page) setSections([...page.sections].sort((a, b) => a.position - b.position))
      })
      .catch(() => {})
  }, [])

  return (
    <>
      {sections.map(section => (
        <SectionResolver key={section.id} section={section} />
      ))}
      <GalerieModernView />
    </>
  )
}
