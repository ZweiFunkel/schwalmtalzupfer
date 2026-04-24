import React, { useState } from 'react'
import { TermineListContent, Termin, TerminKategorie } from '@/types/page'

const KATEGORIE_CONFIG: Record<TerminKategorie, {
  label: string
  icon: string
  border: string      // left border color
  badge: string       // badge classes
  dateBg: string      // date block bg
  dateText: string    // date block text
}> = {
  konzert:  {
    label: 'Konzert',   icon: '🎸',
    border:   'border-l-green-500',
    badge:    'bg-green-900/50 border border-green-500/40 text-green-400',
    dateBg:   'bg-green-900/30',
    dateText: 'text-green-400',
  },
  jugend:   {
    label: 'Jugend',    icon: '🏕️',
    border:   'border-l-amber-500',
    badge:    'bg-amber-900/50 border border-amber-500/40 text-amber-400',
    dateBg:   'bg-amber-900/30',
    dateText: 'text-amber-400',
  },
  ausflug:  {
    label: 'Ausflug',   icon: '🚌',
    border:   'border-l-blue-500',
    badge:    'bg-blue-900/50 border border-blue-500/40 text-blue-400',
    dateBg:   'bg-blue-900/30',
    dateText: 'text-blue-400',
  },
  sonstige: {
    label: 'Sonstiges', icon: '📅',
    border:   'border-l-slate-500',
    badge:    'bg-slate-700 border border-white/10 text-gray-400',
    dateBg:   'bg-slate-800',
    dateText: 'text-gray-400',
  },
}

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

/** Extracts the leading "DD.MM." part for display in the date block */
function parseDateDisplay(date: string): { primary: string; secondary?: string } {
  // Range like "10.07. – 12.07.2026" → primary = "10.07.", secondary = "12.07.2026"
  const rangeParts = date.split(/\s*[–-]\s*/)
  if (rangeParts.length === 2) {
    return { primary: rangeParts[0].trim(), secondary: rangeParts[1].trim() }
  }
  // Single like "28.06.2026" → show day.month and year below
  const m = date.match(/^(\d{1,2}\.\d{1,2})\.\s*(\d{4})?/)
  if (m) return { primary: m[1] + '.', secondary: m[2] }
  return { primary: date }
}

/** Returns month index (0–11) from a date string, or -1 if not parseable */
function getMonthIndex(date: string): number {
  const m = date.match(/(\d{1,2})\.(\d{1,2})\./)
  if (!m) return -1
  return parseInt(m[2], 10) - 1
}

interface TerminGroup { month: number; label: string; items: Termin[] }

function groupByMonth(termine: Termin[]): TerminGroup[] {
  const map = new Map<number, Termin[]>()
  for (const t of termine) {
    const idx = getMonthIndex(t.date)
    const key = idx === -1 ? 99 : idx
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(t)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([key, items]) => ({
      month: key,
      label: key === 99 ? 'Weitere' : MONTH_NAMES[key],
      items,
    }))
}

export default function TermineListSection({ content }: { content: TermineListContent }) {
  const termine: Termin[] = content.termine ?? []
  const groups = groupByMonth(termine)

  return (
    <section className="bg-white dark:bg-slate-950 py-24">
      <div className="mx-auto max-w-3xl px-6">

        {/* Header */}
        <div className="mb-10">
          <div className="mb-3 flex items-center gap-3">
            <span className="h-0.5 w-10 bg-green-500 rounded-full" />
            <span className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400">Kalender</span>
          </div>
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white">
            {content.heading ?? 'Termine'}{content.year ? ` ${content.year}` : ''}
          </h2>
        </div>

        {/* Legende */}
        <div className="mb-10 flex flex-wrap gap-2">
          {(Object.keys(KATEGORIE_CONFIG) as TerminKategorie[]).map(k => {
            const c = KATEGORIE_CONFIG[k]
            return (
              <span key={k} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${c.badge}`}>
                {c.icon} {c.label}
              </span>
            )
          })}
        </div>

        {/* Grouped list */}
        {termine.length === 0 && (
          <p className="text-gray-400 dark:text-gray-500 italic">Noch keine Termine eingetragen.</p>
        )}

        <div className="space-y-10">
          {groups.map(group => (
            <div key={group.month}>
              {/* Month header */}
              <div className="mb-4 flex items-center gap-3">
                <span className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{group.label}</span>
                <span className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
              </div>

              {/* Events */}
              <div className="flex flex-col gap-3">
                {group.items.map((t, i) => {
                  const c = KATEGORIE_CONFIG[t.kategorie] ?? KATEGORIE_CONFIG.sonstige
                  const { primary, secondary } = parseDateDisplay(t.date)
                  return (
                    <div key={i} className="flex gap-4 items-stretch">

                      {/* Date block */}
                      <div className={`flex-shrink-0 w-16 rounded-xl ${c.dateBg} flex flex-col items-center justify-center py-3 px-1`}>
                        <span className={`text-base font-bold leading-tight ${c.dateText}`}>{primary}</span>
                        {secondary && (
                          <span className="text-[10px] text-gray-500 leading-tight mt-0.5 text-center">{secondary}</span>
                        )}
                      </div>

                      {/* Card */}
                      <div className={`flex-1 rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-slate-900/60 border-l-4 ${c.border} px-4 py-3 flex flex-col justify-center gap-1`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-snug">{t.title}</h3>
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.badge}`}>
                            {c.icon} {c.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {t.time && (
                            <span className="flex items-center gap-1">🕐 {t.time}</span>
                          )}
                          {t.location && t.location !== '-' && (
                            t.mapUrl
                              ? <a href={t.mapUrl} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 underline underline-offset-2 transition">
                                  📍 {t.location}
                                </a>
                              : <span className="flex items-center gap-1">📍 {t.location}</span>
                          )}
                          {t.note && (
                            <span className="flex items-center gap-1 text-yellow-400/80">ℹ️ {t.note}</span>
                          )}
                        </div>
                        {/* Parkplätze */}
                        {t.parking && t.parking.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-2">
                            {t.parking.map((p, pi) => (
                              <a href={p.mapUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 rounded-full bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-white/10 px-2.5 py-0.5 text-xs text-gray-500 dark:text-gray-400 hover:border-green-500/50 hover:text-green-600 dark:hover:text-green-400 transition">
                                🅿️ {p.name ?? `Parkplatz ${pi + 1}`}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
