import React from 'react'
import { EventCardContent } from '@/types/page'

function formatDate(iso: string) {
  try {
    // Support both ISO and German date formats like "28.06.2026"
    const parts = iso.split('.')
    if (parts.length === 3) {
      return `${parts[0]}. ${new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toLocaleString('de-DE', { month: 'long' })} ${parts[2]}`
    }
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export default function EventCardSection({ content }: { content: EventCardContent }) {
  return (
    <section className="bg-white dark:bg-slate-950 py-24">
      {/* Musical wave top accent */}
      <div className="mb-16 flex items-center justify-center gap-3 opacity-30">
        {[1,2,3,4,5,6,7].map((h, i) => (
          <div
            key={i}
            className="w-1 rounded-full bg-green-400"
            style={{ height: `${[16,28,20,36,24,18,30][i]}px` }}
          />
        ))}
        <span className="mx-2 text-green-400 text-2xl">♩</span>
        {[1,2,3,4,5,6,7].map((h, i) => (
          <div
            key={`r${i}`}
            className="w-1 rounded-full bg-green-400"
            style={{ height: `${[30,18,24,36,20,28,16][i]}px` }}
          />
        ))}
      </div>

      <div className="mx-auto max-w-6xl px-6">
        <h2 className="mb-12 text-center text-4xl font-bold text-gray-900 dark:text-white">
          Konzerte &amp; Veranstaltungen
        </h2>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {content.events.map((event, idx) => (
            <div
              key={idx}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 backdrop-blur-sm transition hover:-translate-y-1 hover:border-green-500/40"
            >
              {/* Date badge */}
              <div className="absolute left-4 top-4 z-10 rounded-xl bg-green-500 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg">
                {formatDate(event.date)}
              </div>

              {event.imageUrl && (
                <div className="h-48 overflow-hidden">
                  <img
                    src={event.imageUrl}
                    alt={event.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
              )}
              {!event.imageUrl && (
                <div className="flex h-32 items-center justify-center bg-gradient-to-br from-green-100 dark:from-green-900/40 to-blue-100 dark:to-blue-900/40">
                  <span className="text-5xl opacity-40">🎵</span>
                </div>
              )}

              <div className="flex flex-1 flex-col p-6 pt-8">
                <h3 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">{event.title}</h3>
                <p className="mb-3 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                  <span>📍</span>
                  {event.location}
                </p>
                {event.description && (
                  <p className="flex-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{event.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
