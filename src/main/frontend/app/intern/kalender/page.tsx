'use client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { getApiBase } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API_BASE = getApiBase()

// ─── Types ────────────────────────────────────────────────────────────────────

type Kategorie = 'konzert' | 'jugend' | 'ausflug' | 'unterricht' | 'sonstige'

interface KalenderTermin {
  id: string
  titel: string
  kategorie: Kategorie
  startDatum: string // YYYY-MM-DD
  endDatum: string | null
  uhrzeitVon: string | null // HH:mm[:ss]
  uhrzeitBis: string | null
  ort: string | null
  beschreibung: string | null
  abgesagt: boolean
  absageGrund: string | null
  gitarrengruppeId: string | null
  istUnterricht: boolean
  generiert: boolean
}

type ViewMode = 'monat' | 'woche' | 'tag'

// ─── Kategorie-Darstellung (Emoji + Farben, konsistent mit Admin/App) ────────

const KAT_STYLE: Record<Kategorie, { label: string; icon: string; chip: string; dot: string }> = {
  konzert:    { label: 'Konzert',    icon: '🎸', dot: 'bg-green-500',  chip: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  jugend:     { label: 'Jugend',     icon: '🏕️', dot: 'bg-sky-500',    chip: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300' },
  ausflug:    { label: 'Ausflug',    icon: '🚌', dot: 'bg-amber-500',  chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  unterricht: { label: 'Unterricht', icon: '🎓', dot: 'bg-violet-500', chip: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300' },
  sonstige:   { label: 'Sonstiges',  icon: '📅', dot: 'bg-gray-400',   chip: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300' },
}
function katStyle(k: string) { return KAT_STYLE[k as Kategorie] ?? KAT_STYLE.sonstige }

// ─── Datums-Helfer (bewusst ohne Zeitzonen-Stolperfallen: alles lokale Mitternacht) ─

const WOCHENTAGE_KURZ = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const WOCHENTAGE_LANG = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

function pad2(n: number) { return n.toString().padStart(2, '0') }
function toIso(d: Date): string { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
function parseIso(s: string): Date { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function addMonths(d: Date, n: number): Date { const r = new Date(d); r.setMonth(r.getMonth() + n); return r }
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1) }
function startOfWeek(d: Date): Date { const r = new Date(d); const day = (r.getDay() + 6) % 7; r.setDate(r.getDate() - day); return r }
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}
function formatTime(t: string): string {
  const [h, m] = t.split(':')
  return `${h}:${m}`
}

// Ist das Event an diesem Tag "ganztägig" zu behandeln (keine Uhrzeit, oder Datumsspanne über mehrere Tage)?
function isAllDay(t: KalenderTermin): boolean {
  return !t.uhrzeitVon || (!!t.endDatum && t.endDatum !== t.startDatum)
}

function eventsOnDay(events: KalenderTermin[], day: Date): KalenderTermin[] {
  const iso = toIso(day)
  return events.filter(e => {
    const start = e.startDatum
    const end = e.endDatum ?? e.startDatum
    return iso >= start && iso <= end
  })
}

// ─── Kleine Icons ─────────────────────────────────────────────────────────────

function ChevronIcon({ dir, className = 'h-5 w-5' }: { dir: 'left' | 'right'; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d={dir === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
    </svg>
  )
}

function DownloadIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}

// ─── Event-Detail (Klick auf ein Event) ──────────────────────────────────────

function EventDetailModal({ event, onClose }: { event: KalenderTermin; onClose: () => void }) {
  const style = katStyle(event.kategorie)
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.chip}`}>
            <span>{style.icon}</span>{style.label}
          </span>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white transition">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <h3 className="mt-3 text-lg font-bold text-gray-900 dark:text-white">{event.titel}</h3>

        <div className="mt-3 flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-300">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0V11.25A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span>
              {event.endDatum && event.endDatum !== event.startDatum
                ? `${parseIso(event.startDatum).toLocaleDateString('de-DE')} – ${parseIso(event.endDatum).toLocaleDateString('de-DE')}`
                : parseIso(event.startDatum).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              {event.uhrzeitVon && `, ${formatTime(event.uhrzeitVon)}${event.uhrzeitBis ? ` – ${formatTime(event.uhrzeitBis)}` : ''} Uhr`}
            </span>
          </div>
          {event.ort && (
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <span>{event.ort}</span>
            </div>
          )}
          {event.beschreibung && (
            <p className="mt-1 whitespace-pre-line text-gray-500 dark:text-gray-400">{event.beschreibung}</p>
          )}
        </div>

        {event.abgesagt && (
          <div className="mt-4 rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {event.istUnterricht ? 'Kein Unterricht' : 'Abgesagt'}{event.absageGrund ? `: ${event.absageGrund}` : ''}
          </div>
        )}
        {event.generiert && (
          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">Regelmäßige Unterrichtsstunde (automatisch aus dem Gruppenplan)</p>
        )}
      </div>
    </div>
  )
}

// ─── Event-Chip (Monatsansicht) ──────────────────────────────────────────────

function MonthEventChip({ event, onClick }: { event: KalenderTermin; onClick: () => void }) {
  const style = katStyle(event.kategorie)
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      className={`w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium transition hover:opacity-80 ${style.chip} ${event.abgesagt ? 'line-through opacity-60' : ''}`}
      title={event.titel}
    >
      {event.uhrzeitVon && <span className="font-mono opacity-70">{formatTime(event.uhrzeitVon)} </span>}
      {event.titel}
    </button>
  )
}

// ─── Monatsansicht ────────────────────────────────────────────────────────────

function MonthView({ cursor, events, today, onSelectDay, onSelectEvent }: {
  cursor: Date; events: KalenderTermin[]; today: Date
  onSelectDay: (d: Date) => void; onSelectEvent: (e: KalenderTermin) => void
}) {
  const gridStart = startOfWeek(startOfMonth(cursor))
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const month = cursor.getMonth()
  const MAX_VISIBLE = 3

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
        {WOCHENTAGE_KURZ.map(w => (
          <div key={w} className="px-2 py-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dayEvents = eventsOnDay(events, day).sort((a, b) => (a.uhrzeitVon ?? '').localeCompare(b.uhrzeitVon ?? ''))
          const inMonth = day.getMonth() === month
          const isToday = isSameDay(day, today)
          return (
            <div
              key={i}
              onClick={() => onSelectDay(day)}
              className={`min-h-[110px] cursor-pointer border-b border-r border-gray-100 dark:border-white/5 p-1.5 transition hover:bg-gray-50 dark:hover:bg-white/5 ${
                i % 7 === 6 ? 'border-r-0' : ''
              } ${!inMonth ? 'bg-gray-50/50 dark:bg-black/10' : ''}`}
            >
              <div className="mb-1 flex justify-end">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isToday ? 'bg-green-600 font-bold text-white' : inMonth ? 'text-gray-700 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600'
                }`}>
                  {day.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                {dayEvents.slice(0, MAX_VISIBLE).map(ev => (
                  <MonthEventChip key={ev.id} event={ev} onClick={() => onSelectEvent(ev)} />
                ))}
                {dayEvents.length > MAX_VISIBLE && (
                  <span className="px-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                    +{dayEvents.length - MAX_VISIBLE} weitere
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Zeitraster (Wochen-/Tagesansicht, gemeinsam genutzt) ────────────────────

const START_HOUR = 7
const END_HOUR = 22
const HOUR_HEIGHT = 52 // px

function TimeGrid({ days, events, today, onSelectEvent }: {
  days: Date[]; events: KalenderTermin[]; today: Date; onSelectEvent: (e: KalenderTermin) => void
}) {
  const hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
      {/* Kopfzeile */}
      <div className="grid border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        <div />
        {days.map((d, i) => (
          <div key={i} className={`px-2 py-2 text-center border-l border-gray-100 dark:border-white/5 ${isSameDay(d, today) ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'}`}>
            <div className="text-[11px] font-semibold uppercase">{WOCHENTAGE_KURZ[(d.getDay() + 6) % 7]}</div>
            <div className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm ${isSameDay(d, today) ? 'bg-green-600 font-bold text-white' : ''}`}>
              {d.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* Ganztägige Termine */}
      {days.some(d => eventsOnDay(events, d).some(isAllDay)) && (
        <div className="grid border-b border-gray-200 dark:border-white/10" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
          <div className="px-1.5 py-1.5 text-[10px] text-gray-400">ganztägig</div>
          {days.map((d, i) => (
            <div key={i} className="flex flex-col gap-1 border-l border-gray-100 dark:border-white/5 p-1">
              {eventsOnDay(events, d).filter(isAllDay).map(ev => {
                const style = katStyle(ev.kategorie)
                return (
                  <button
                    key={ev.id}
                    onClick={() => onSelectEvent(ev)}
                    className={`truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium transition hover:opacity-80 ${style.chip} ${ev.abgesagt ? 'line-through opacity-60' : ''}`}
                  >
                    {ev.titel}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Stunden-Raster */}
      <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        <div>
          {hours.map(h => (
            <div key={h} className="relative border-b border-gray-100 dark:border-white/5 text-right" style={{ height: HOUR_HEIGHT }}>
              <span className="absolute -top-2 right-1.5 text-[11px] text-gray-400 dark:text-gray-500">{h}:00</span>
            </div>
          ))}
        </div>
        {days.map((d, i) => {
          const timed = eventsOnDay(events, d).filter(ev => !isAllDay(ev))
          return (
            <div key={i} className="relative border-l border-gray-100 dark:border-white/5">
              {hours.map(h => <div key={h} className="border-b border-gray-100 dark:border-white/5" style={{ height: HOUR_HEIGHT }} />)}
              {timed.map(ev => {
                const style = katStyle(ev.kategorie)
                const startMin = Math.max(timeToMinutes(ev.uhrzeitVon!), START_HOUR * 60)
                const endMin = Math.min(ev.uhrzeitBis ? timeToMinutes(ev.uhrzeitBis) : startMin + 60, (END_HOUR + 1) * 60)
                const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT
                const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 20)
                return (
                  <button
                    key={ev.id}
                    onClick={() => onSelectEvent(ev)}
                    style={{ top, height }}
                    className={`absolute left-0.5 right-0.5 overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium shadow-sm transition hover:opacity-90 ${style.chip} ${ev.abgesagt ? 'line-through opacity-60' : ''}`}
                  >
                    <div className="truncate font-semibold">{ev.titel}</div>
                    <div className="truncate opacity-80">{formatTime(ev.uhrzeitVon!)} Uhr</div>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Legende ──────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500 dark:text-gray-400">
      {(Object.keys(KAT_STYLE) as Kategorie[]).map(k => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${KAT_STYLE[k].dot}`} />
          {KAT_STYLE[k].label}
        </span>
      ))}
    </div>
  )
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────

export default function KalenderPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [view, setView] = useState<ViewMode>('monat')
  const [cursor, setCursor] = useState(() => new Date())
  const [events, setEvents] = useState<KalenderTermin[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<KalenderTermin | null>(null)
  const today = useMemo(() => new Date(), [])

  useEffect(() => { document.title = 'Kalender – Schwalmtalzupfer' }, [])
  useEffect(() => { if (!loading && !user) router.push('/login') }, [user, loading, router])

  // Sichtbaren Zeitraum je nach Ansicht berechnen (inkl. Rand-Wochentage im Monatsraster)
  const { von, bis } = useMemo(() => {
    if (view === 'monat') {
      const gridStart = startOfWeek(startOfMonth(cursor))
      return { von: toIso(gridStart), bis: toIso(addDays(gridStart, 41)) }
    }
    if (view === 'woche') {
      const ws = startOfWeek(cursor)
      return { von: toIso(ws), bis: toIso(addDays(ws, 6)) }
    }
    return { von: toIso(cursor), bis: toIso(cursor) }
  }, [view, cursor])

  useEffect(() => {
    if (!user) return
    setEventsLoading(true)
    fetch(`${API_BASE}/api/kalender/termine?von=${von}&bis=${bis}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: KalenderTermin[]) => setEvents(data))
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false))
  }, [user, von, bis])

  const goPrev = useCallback(() => {
    setCursor(c => view === 'monat' ? addMonths(c, -1) : view === 'woche' ? addDays(c, -7) : addDays(c, -1))
  }, [view])
  const goNext = useCallback(() => {
    setCursor(c => view === 'monat' ? addMonths(c, 1) : view === 'woche' ? addDays(c, 7) : addDays(c, 1))
  }, [view])
  const goToday = useCallback(() => setCursor(new Date()), [])

  const periodLabel = useMemo(() => {
    if (view === 'monat') return `${MONATE[cursor.getMonth()]} ${cursor.getFullYear()}`
    if (view === 'woche') {
      const ws = startOfWeek(cursor)
      const we = addDays(ws, 6)
      return `${pad2(ws.getDate())}.${pad2(ws.getMonth() + 1)}. – ${pad2(we.getDate())}.${pad2(we.getMonth() + 1)}.${we.getFullYear()}`
    }
    return `${WOCHENTAGE_LANG[(cursor.getDay() + 6) % 7]}, ${cursor.getDate()}. ${MONATE[cursor.getMonth()]} ${cursor.getFullYear()}`
  }, [view, cursor])

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-gray-400">Laden…</div>
  if (!user) return null

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
            <Link href="/intern" className="hover:text-green-500 dark:hover:text-green-400 transition">Intern</Link>
            <span>/</span>
            <span className="text-gray-500 dark:text-gray-300">Kalender</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Kalender</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Konzerte, Ausflüge, Unterricht & mehr auf einen Blick</p>
        </div>
        <a
          href={`${API_BASE}/api/kalender/ics?von=${von}&bis=${bis}`}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:border-green-500/40 hover:text-green-500 dark:hover:text-green-400 transition"
        >
          <DownloadIcon className="h-3.5 w-3.5" />
          Kalender exportieren
        </a>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="rounded-lg border border-gray-200 dark:border-white/10 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition">
            Heute
          </button>
          <div className="flex items-center">
            <button onClick={goPrev} className="rounded-lg p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition"><ChevronIcon dir="left" /></button>
            <button onClick={goNext} className="rounded-lg p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 transition"><ChevronIcon dir="right" /></button>
          </div>
          <span className="text-base font-semibold text-gray-800 dark:text-white">{periodLabel}</span>
        </div>

        <div className="flex rounded-lg border border-gray-200 dark:border-white/10 p-0.5">
          {(['monat', 'woche', 'tag'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
                view === v ? 'bg-green-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4"><Legend /></div>

      {eventsLoading ? (
        <div className="flex min-h-[300px] items-center justify-center text-sm text-gray-400">Lädt…</div>
      ) : view === 'monat' ? (
        <MonthView
          cursor={cursor}
          events={events}
          today={today}
          onSelectDay={d => { setCursor(d); setView('tag') }}
          onSelectEvent={setSelectedEvent}
        />
      ) : view === 'woche' ? (
        <TimeGrid days={Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))} events={events} today={today} onSelectEvent={setSelectedEvent} />
      ) : (
        <TimeGrid days={[cursor]} events={events} today={today} onSelectEvent={setSelectedEvent} />
      )}

      {selectedEvent && <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </div>
  )
}
