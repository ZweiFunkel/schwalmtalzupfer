'use client'
import React, { useEffect, useState } from 'react'
import { getApiBase } from '@/lib/api'
import { TermineKonzerteContent, Termin } from '@/types/page'

const API_BASE = getApiBase()

function parseDate(d: string): Date {
  const parts = d.split('.')
  if (parts.length === 3) {
    return new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`)
  }
  // Handle range like "10.07. – 12.07.2026" → use start date
  const start = d.split(/\s*[–-]\s*/)[0].trim()
  const sp = start.split('.')
  if (sp.length >= 2) {
    const year = new Date().getFullYear()
    return new Date(`${year}-${sp[1].padStart(2, '0')}-${sp[0].padStart(2, '0')}`)
  }
  return new Date(d)
}

function formatDate(d: string) {
  try {
    const parts = d.split('.')
    if (parts.length === 3) {
      const month = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`)
        .toLocaleString('de-DE', { month: 'long' })
      return `${parseInt(parts[0])}. ${month} ${parts[2]}`
    }
    return d
  } catch { return d }
}

function DaysUntil({ date }: { date: string }) {
  const target = parseDate(date)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return <span className="font-semibold text-green-500">Heute!</span>
  if (diff === 1) return <span className="text-amber-500 font-medium">Morgen</span>
  if (diff < 0) return null
  return <span className="text-gray-400">in {diff} Tagen</span>
}

export default function TermineKonzerteSection({ content }: { content: TermineKonzerteContent }) {
  const [termine, setTermine] = useState<Termin[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_BASE}/api/termine/konzerte`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Termin[]) => {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const upcoming = data
          .filter(t => parseDate(t.date) >= today)
          .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime())
        setTermine(upcoming.slice(0, content.maxItems ?? 6))
      })
      .catch(() => setTermine([]))
      .finally(() => setLoading(false))
  }, [content.maxItems])

  return (
    <section className="bg-white dark:bg-slate-950 py-24">
      <div className="mx-auto max-w-6xl px-6">

        <div className="mb-12">
          <div className="mb-3 flex items-center gap-3">
            <span className="h-0.5 w-10 bg-green-500 rounded-full" />
            <span className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400">Konzerte</span>
          </div>
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white">
            {content.heading ?? 'Konzerte & Veranstaltungen'}
          </h2>
        </div>

        {loading && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse rounded-2xl bg-gray-200 dark:bg-slate-800 h-52" />
            ))}
          </div>
        )}

        {!loading && termine.length === 0 && (
          <div className="flex items-center gap-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800/40 px-6 py-5">
            <span className="text-3xl opacity-40">🎵</span>
            <p className="text-gray-500 dark:text-gray-400">Derzeit sind keine Konzerte geplant.</p>
          </div>
        )}

        {!loading && termine.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {termine.map((t, i) => (
              <div key={i} className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 backdrop-blur-sm transition hover:-translate-y-1 hover:border-green-500/40 hover:shadow-lg">
                {/* Top accent */}
                <div className="h-1.5 w-full bg-gradient-to-r from-green-500 to-emerald-400" />

                <div className="flex flex-1 flex-col p-6">
                  {/* Date badge */}
                  <div className="mb-4 inline-flex self-start items-center gap-1.5 rounded-xl bg-green-500 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow">
                    📅 {formatDate(t.date)}
                  </div>

                  <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white leading-snug">{t.title}</h3>

                  <div className="flex flex-col gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                    {t.location && t.location !== '-' && (
                      t.mapUrl
                        ? <a href={t.mapUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-500 hover:text-blue-400 transition">
                            📍 {t.location}
                          </a>
                        : <span className="flex items-center gap-1.5">📍 {t.location}</span>
                    )}
                    {t.time && <span className="flex items-center gap-1.5">🕐 {t.time}</span>}
                    {t.note && <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400/80">ℹ️ {t.note}</span>}
                  </div>

                  <div className="mt-auto pt-4 text-sm">
                    <DaysUntil date={t.date} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}