'use client'
import React, { useState } from 'react'
import { TermineListContent, Termin, TerminKategorie } from '@/types/page'
import { useMeldungen, getMeldungById } from '@/lib/useMeldungen'
import { MeldungModal } from '@/components/AnnouncementBanner'

const KATEGORIE_CONFIG: Record<TerminKategorie, { label: string; icon: string }> = {
  konzert:  { label: 'Konzert',   icon: '🎸' },
  jugend:   { label: 'Jugend',    icon: '🏕️' },
  ausflug:  { label: 'Ausflug',   icon: '🚌' },
  sonstige: { label: 'Sonstiges', icon: '📅' },
}

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

const STORAGE_KEY = 'termine_filter'

function readStoredFilter(): TerminKategorie | 'alle' {
  if (typeof window === 'undefined') return 'alle'
  const v = localStorage.getItem(STORAGE_KEY)
  if (v === 'alle' || (v && v in KATEGORIE_CONFIG)) return v as TerminKategorie | 'alle'
  return 'alle'
}

function getYearMonth(date: string): { year: number; month: number } {
  const full = date.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (full) return { month: parseInt(full[2], 10) - 1, year: parseInt(full[3], 10) }
  const short = date.match(/(\d{1,2})\.(\d{1,2})\./)
  if (short) return { month: parseInt(short[2], 10) - 1, year: new Date().getFullYear() }
  return { month: -1, year: new Date().getFullYear() }
}

function parseDateDisplay(date: string): { day: string; month: string } {
  const start = date.split(/\s*[–-]\s*/)[0].trim()
  const m = start.match(/^(\d{1,2})\.(\d{1,2})/)
  if (m) {
    const monthShort = MONTH_NAMES[parseInt(m[2], 10) - 1]?.slice(0, 3) ?? m[2]
    return { day: m[1], month: monthShort }
  }
  return { day: start, month: '' }
}

function isArchived(archivedAfter?: string): boolean {
  if (!archivedAfter) return false
  const parts = archivedAfter.split('.')
  if (parts.length !== 3) return false
  return new Date(+parts[2], +parts[1] - 1, +parts[0]) < new Date()
}

function isPast(date: string): boolean {
  // Use end date for ranges, start date for single dates
  const parts = date.split(/\s*[–-]\s*/)
  const end = parts[parts.length - 1].trim()
  const m = end.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (m) {
    return new Date(+m[3], +m[2] - 1, +m[1], 23, 59, 59) < new Date()
  }
  // Date without year: assume current year, don't hide
  return false
}

interface TerminGroup { yearMonth: number; year: number; month: number; label: string; items: Termin[] }

function groupByMonth(termine: Termin[]): TerminGroup[] {
  const currentYear = new Date().getFullYear()
  const map = new Map<number, { year: number; month: number; items: Termin[] }>()
  for (const t of termine) {
    const { year, month } = getYearMonth(t.date)
    const key = year * 100 + month
    if (!map.has(key)) map.set(key, { year, month, items: [] })
    map.get(key)!.items.push(t)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([key, { year, month, items }]) => ({
      yearMonth: key, year, month, items,
      label: month === -1 ? 'Weitere' : year !== currentYear ? `${MONTH_NAMES[month]} ${year}` : MONTH_NAMES[month],
    }))
}

// ─── Ticket-Block ─────────────────────────────────────────────────────────────

function TicketBlock({ tickets }: { tickets: NonNullable<Termin['tickets']> }) {
  const hasAny = tickets.link || tickets.priceAdults || tickets.priceChildren || tickets.info
  if (!hasAny) return null
  return (
    <div className="mt-3 rounded-lg border border-green-200 dark:border-green-500/20 bg-green-50 dark:bg-green-900/10 px-3 py-2.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-green-700 dark:text-green-400 mb-0.5">
        🎟️ Tickets
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
        {tickets.priceAdults && (
          <span>Erwachsene: <strong>{tickets.priceAdults}</strong></span>
        )}
        {tickets.priceChildren && (
          <span>Kinder: <strong>{tickets.priceChildren}</strong></span>
        )}
      </div>
      {tickets.info && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{tickets.info}</p>
      )}
      {tickets.link && (
        <a href={tickets.link} target="_blank" rel="noopener noreferrer"
          className="mt-0.5 inline-flex items-center gap-1.5 self-start rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500 transition">
          Tickets kaufen →
        </a>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TermineListSection({ content }: { content: TermineListContent }) {
  const [filter, setFilter] = useState<TerminKategorie | 'alle'>(readStoredFilter)
  const [showPast, setShowPast] = useState(false)
  const [activeMeldungId, setActiveMeldungId] = useState<string | null>(null)
  const meldungen = useMeldungen()
  const activeMeldung = activeMeldungId ? getMeldungById(meldungen, activeMeldungId) : undefined

  const handleFilter = (f: TerminKategorie | 'alle') => {
    setFilter(f)
    localStorage.setItem(STORAGE_KEY, f)
  }

  const termine: Termin[] = content.termine ?? []
  const visible = termine.filter(t =>
    (showPast || !isPast(t.date)) &&
    (filter === 'alle' || t.kategorie === filter)
  )
  const pastCount = termine.filter(t => isPast(t.date) && (filter === 'alle' || t.kategorie === filter)).length
  const groups = groupByMonth(visible)

  return (
    <section className="bg-white dark:bg-slate-950 py-24">
      <div className="mx-auto max-w-2xl px-6">

        {/* Header */}
        <div className="mb-10">
          <div className="mb-3 flex items-center gap-3">
            <span className="h-0.5 w-10 bg-green-500 rounded-full" />
            <span className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400">Kalender</span>
          </div>
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white">
            {content.heading ?? 'Termine'}
          </h2>
        </div>

        {/* Filter-Tabs */}
        <div className="mb-10 flex flex-wrap gap-2">
          {(['alle', ...Object.keys(KATEGORIE_CONFIG)] as (TerminKategorie | 'alle')[]).map(k => {
            const label = k === 'alle' ? 'Alle' : `${KATEGORIE_CONFIG[k].icon} ${KATEGORIE_CONFIG[k].label}`
            return (
              <button key={k} onClick={() => handleFilter(k)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  filter === k
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-white/8 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/15 hover:text-gray-700 dark:hover:text-white'
                }`}>
                {label}
              </button>
            )
          })}
        </div>

        {/* Empty */}
        {termine.length === 0 && (
          <p className="text-gray-400 italic">Noch keine Termine eingetragen.</p>
        )}

        {/* List */}
        <div className="space-y-10">
          {groups.map((group, gi) => {
            const currentYear = new Date().getFullYear()
            const prevGroup = groups[gi - 1]
            const showYearBanner = group.year !== currentYear && group.year !== prevGroup?.year
            const monthLabel = group.month === -1 ? 'Weitere' : MONTH_NAMES[group.month]
            return (
            <div key={group.yearMonth}>
              {/* Year separator — only shown when year changes and differs from current */}
              {showYearBanner && (
                <div className="mb-8 -mx-1 flex items-center gap-4">
                  <div className="flex items-center gap-2 rounded-xl border border-green-500/25 bg-green-500/8 px-4 py-2">
                    <span className="text-lg font-black text-green-500/80 tabular-nums">{group.year}</span>
                  </div>
                  <span className="flex-1 h-px bg-green-500/15" />
                </div>
              )}
              <div className="mb-5 flex items-center gap-4">
                <span className="w-20 text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{monthLabel}</span>
                <span className="flex-1 h-px bg-gray-100 dark:bg-white/8" />
              </div>

              <div className="flex flex-col gap-3">
                {group.items.map((t, i) => {
                  const cat = KATEGORIE_CONFIG[t.kategorie] ?? KATEGORIE_CONFIG.sonstige
                  const { day, month } = parseDateDisplay(t.date)
                  const isRange = t.date.includes('–') || t.date.includes('-')

                  return (
                    <div key={i} className={`flex gap-4 items-stretch group ${t.cancelled ? 'opacity-60' : ''}`}>
                      {/* Date */}
                      <div className="w-14 shrink-0 flex flex-col items-center justify-center text-center pt-1">
                        <span className={`text-2xl font-bold leading-none ${t.cancelled ? 'text-gray-400 dark:text-gray-600' : 'text-gray-800 dark:text-white'}`}>{day}</span>
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mt-0.5">
                          {isRange ? '···' : month}
                        </span>
                      </div>

                      {/* Card */}
                      <div className={`flex-1 rounded-xl border px-4 py-3 transition ${
                        t.cancelled
                          ? 'border-red-200 dark:border-red-900/40 bg-red-50/60 dark:bg-red-950/20'
                          : 'border-gray-100 dark:border-white/8 bg-gray-50 dark:bg-slate-900/60 group-hover:border-gray-200 dark:group-hover:border-white/15'
                      }`}>
                        <div className="flex items-center justify-between gap-3">
                          <h3 className={`text-sm font-semibold leading-snug ${t.cancelled ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                            {t.title}
                          </h3>
                          <div className="flex items-center gap-2 shrink-0">
                            {t.cancelled && (
                              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                                Abgesagt
                              </span>
                            )}
                            {isArchived(t.archivedAfter) && !t.cancelled && (
                              <span className="rounded-full bg-slate-400/20 border border-slate-400/20 px-2 py-0.5 text-[10px] font-medium text-gray-400 dark:text-gray-600">
                                Archiviert
                              </span>
                            )}
                            <span className="text-xs text-gray-400 dark:text-gray-500">{cat.icon} {cat.label}</span>
                          </div>
                        </div>

                        {/* Absagegrund + Weitere Infos */}
                        {t.cancelled && t.cancellationNote && (
                          <p className="mt-1.5 text-xs text-red-500 dark:text-red-400">{t.cancellationNote}</p>
                        )}
                        {t.cancelled && t.meldungId && getMeldungById(meldungen, t.meldungId) && (
                          <button
                            onClick={() => setActiveMeldungId(t.meldungId!)}
                            className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-300/50 dark:border-red-700/50 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition"
                          >
                            ℹ️ Weitere Infos
                          </button>
                        )}

                        {!t.cancelled && (
                          <>
                            {isRange && (
                              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{t.date}</p>
                            )}

                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                              {t.time && t.time.split('\n').map((line, li) => line.trim() && (
                                <span key={li} className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                                  {li === 0 ? '🕐' : <span className="w-4 shrink-0" />} {line.trim()}
                                </span>
                              ))}
                              {t.location && t.location !== '-' && (
                                t.mapUrl
                                  ? <a href={t.mapUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 transition">📍 {t.location}</a>
                                  : <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">📍 {t.location}</span>
                              )}
                              {t.note && <span className="flex items-center gap-1 text-xs text-amber-500 dark:text-amber-400/80">ℹ️ {t.note}</span>}
                            </div>

                            {t.details && (
                              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 whitespace-pre-line leading-relaxed">{t.details}</p>
                            )}

                            {t.tickets && <TicketBlock tickets={t.tickets} />}

                            {t.parking && t.parking.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {t.parking.map((p, pi) => (
                                  <a key={pi} href={p.mapUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 rounded-full border border-gray-200 dark:border-white/10 px-2.5 py-0.5 text-xs text-gray-500 dark:text-gray-400 hover:border-green-400/50 hover:text-green-600 dark:hover:text-green-400 transition">
                                    🅿️ {p.name ?? `Parkplatz ${pi + 1}`}
                                  </a>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )})}
        </div>

        {/* Toggle past termine */}
        {pastCount > 0 && (
          <button
            onClick={() => setShowPast(v => !v)}
            className="mt-10 flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
          >
            <span className={`transition-transform ${showPast ? 'rotate-90' : ''}`}>▸</span>
            {showPast ? 'Vergangene ausblenden' : `${pastCount} vergangene${pastCount === 1 ? 'n' : ''} Termin${pastCount === 1 ? '' : 'e'} anzeigen`}
          </button>
        )}

      </div>

      {activeMeldung && (
        <MeldungModal meldung={activeMeldung} onClose={() => setActiveMeldungId(null)} />
      )}
    </section>
  )
}
