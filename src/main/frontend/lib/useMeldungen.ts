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
  validFrom?: string   // dd.MM.yyyy – Anfang des Zeitfensters (inkl.)
  validUntil?: string  // dd.MM.yyyy – Ende des Zeitfensters (inkl.)
}

function parseDMY(s: string): Date {
  const p = s.split('.')
  return new Date(+p[2], +p[1] - 1, +p[0])
}

/** Gibt true zurück, wenn die Meldung heute aufgrund ihres Zeitfensters aktiv ist. */
export function isMeldungScheduledNow(m: Meldung): boolean {
  if (!m.validFrom && !m.validUntil) return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (m.validFrom && parseDMY(m.validFrom) > today) return false
  if (m.validUntil && parseDMY(m.validUntil) < today) return false
  return true
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
