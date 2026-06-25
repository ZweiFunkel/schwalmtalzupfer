'use client'
import { useEffect, useState } from 'react'
import { getApiBase } from '@/lib/api'

const API_BASE = getApiBase()

export interface Meldung {
  id: string
  title: string
  text: string
  body?: string
  imageUrl?: string
  style?: 'info' | 'warning' | 'success'
  activeForBanner: boolean
}

let cache: Meldung[] | null = null
const listeners: Array<(m: Meldung[]) => void> = []

async function fetchMeldungen(): Promise<Meldung[]> {
  try {
    const r = await fetch(`${API_BASE}/api/site/settings`)
    if (!r.ok) return []
    const data: Record<string, string> = await r.json()
    if (!data.meldungen) return []
    return JSON.parse(data.meldungen) as Meldung[]
  } catch { return [] }
}

export function useMeldungen() {
  const [meldungen, setMeldungen] = useState<Meldung[]>(cache ?? [])

  useEffect(() => {
    if (cache !== null) { setMeldungen(cache); return }
    fetchMeldungen().then(m => {
      cache = m
      setMeldungen(m)
      listeners.forEach(l => l(m))
    })
  }, [])

  return meldungen
}

export function getMeldungById(meldungen: Meldung[], id: string | undefined): Meldung | undefined {
  if (!id) return undefined
  return meldungen.find(m => m.id === id)
}

export function invalidateMeldungenCache() {
  cache = null
}
