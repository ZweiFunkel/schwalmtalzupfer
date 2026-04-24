'use client'

import React, { useEffect, useState } from 'react'
import { NextConcertContent, EventCardItem } from '@/types/page'

function parseDate(d: string): Date {
  const parts = d.split('.')
  if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
  return new Date(d)
}

function formatDate(d: string) {
  try {
    const parts = d.split('.')
    if (parts.length === 3) {
      const month = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toLocaleString('de-DE', { month: 'long' })
      return `${parts[0]}. ${month} ${parts[2]}`
    }
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return d }
}

export default function NextConcertSection({ content }: { content: NextConcertContent }) {
  const [next, setNext] = useState<EventCardItem | null | undefined>(undefined)

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const upcoming = (content.events ?? [])
      .filter((e: EventCardItem) => parseDate(e.date) >= today)
      .sort((a: EventCardItem, b: EventCardItem) => parseDate(a.date).getTime() - parseDate(b.date).getTime())
    setNext(upcoming[0] ?? null)
  }, [content.events])

  return (
    <section className="bg-gray-50 dark:bg-slate-950 py-20">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="h-0.5 w-10 bg-green-500 rounded-full" />
          <span className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400">Nächstes Konzert</span>
        </div>

        {next === undefined && (
          <div className="h-32 animate-pulse rounded-2xl bg-gray-200 dark:bg-slate-800/60" />
        )}

        {next === null && (
          <div className="flex items-center gap-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-slate-800/40 px-6 py-5">
            <span className="text-3xl opacity-40">🎵</span>
            <p className="text-gray-500 dark:text-gray-400">Derzeit sind keine Konzerte geplant.</p>
          </div>
        )}

        {next && (
          <div className="relative overflow-hidden rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-50 dark:from-green-900/20 to-gray-100 dark:to-slate-800/60 p-8">
            <div className="absolute right-6 top-6 rounded-xl bg-green-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-green-900/40">
              {formatDate(next.date)}
            </div>
            <h3 className="mb-2 pr-36 text-2xl font-bold text-gray-900 dark:text-white">{next.title}</h3>
            <p className="mb-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>📍</span>{next.location}
            </p>
            {next.description && (
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{next.description}</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
