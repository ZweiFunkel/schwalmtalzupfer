import React from 'react'
import { EventCardContent } from '@/types/page'

function formatDate(iso: string) {
  try {
    const parts = iso.split('.')
    if (parts.length === 3) {
      return `${parts[0]}. ${new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toLocaleString('de-DE', { month: 'long' })} ${parts[2]}`
    }
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

export default function EventCardSection({ content }: { content: EventCardContent }) {
  return (
    <section className="bg-white dark:bg-slate-950 py-24">
      <div className="mb-16 flex items-center justify-center gap-3 opacity-30">
        {[1,2,3,4,5,6,7].map((_, i) => (
          <div key={i} className="w-1 rounded-full bg-green-400" style={{ height: `${[16,28,20,36,24,18,30][i]}px` }} />
        ))}
        <span className="mx-2 text-green-400 text-2xl">♩</span>
        {[1,2,3,4,5,6,7].map((_, i) => (
          <div key={`r${i}`} className="w-1 rounded-full bg-green-400" style={{ height: `${[30,18,24,36,20,28,16][i]}px` }} />
        ))}
      </div>

      <div className="mx-auto max-w-6xl px-6">
        <h2 className="mb-12 text-center text-4xl font-bold text-gray-900 dark:text-white">
          {content.heading ?? 'Konzerte'}
        </h2>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {content.events.map((event, idx) => {
            const cancelled = event.cancelled === true
            return (
              <div
                key={idx}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border transition hover:-translate-y-1 ${
                  cancelled
                    ? 'border-red-300/40 dark:border-red-800/40 bg-gray-50 dark:bg-slate-900/60 opacity-75'
                    : 'border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 backdrop-blur-sm hover:border-green-500/40'
                }`}
              >
                {/* Abgesagt-Diagonalstreifen */}
                {cancelled && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-10">
                    <div className="absolute -top-1 -right-1 w-28 h-28">
                      <div className="absolute top-7 right-[-28px] w-40 py-1.5 bg-red-500 text-white text-xs font-bold text-center tracking-widest rotate-45 shadow-md">
                        ABGESAGT
                      </div>
                    </div>
                  </div>
                )}

                {/* Date badge */}
                <div className={`absolute left-4 top-4 z-10 rounded-xl px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg ${
                  cancelled ? 'bg-gray-500' : 'bg-green-500'
                }`}>
                  {formatDate(event.date)}
                </div>

                {event.imageUrl && (
                  <div className="h-48 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={event.imageUrl} alt={event.title}
                      className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${cancelled ? 'grayscale' : ''}`} />
                  </div>
                )}
                {!event.imageUrl && (
                  <div className={`flex h-32 items-center justify-center ${
                    cancelled
                      ? 'bg-gray-100 dark:bg-slate-800/40'
                      : 'bg-gradient-to-br from-green-100 dark:from-green-900/40 to-blue-100 dark:to-blue-900/40'
                  }`}>
                    <span className="text-5xl opacity-40">{cancelled ? '🚫' : '🎵'}</span>
                  </div>
                )}

                <div className="flex flex-1 flex-col p-6 pt-8">
                  <h3 className={`mb-2 text-xl font-bold ${
                    cancelled
                      ? 'line-through text-gray-400 dark:text-gray-500'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {event.title}
                  </h3>
                  <p className="mb-3 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                    <span>📍</span>{event.location}
                  </p>
                  {cancelled && event.cancellationNote && (
                    <div className="mb-2 flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-3 py-2">
                      <span className="mt-0.5 text-red-500 shrink-0">ℹ</span>
                      <p className="text-sm text-red-600 dark:text-red-400">{event.cancellationNote}</p>
                    </div>
                  )}
                  {!cancelled && event.description && (
                    <p className="flex-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{event.description}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
