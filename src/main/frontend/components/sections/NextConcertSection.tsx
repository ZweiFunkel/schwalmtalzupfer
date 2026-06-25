'use client'
import React, { useEffect, useState } from 'react'
import { NextConcertContent } from '@/types/page'
import { getApiBase } from '@/lib/api'
import { useMeldungen, getMeldungById } from '@/lib/useMeldungen'
import { MeldungModal } from '@/components/AnnouncementBanner'

const API_BASE = getApiBase()

interface TerminRaw {
  title: string
  date: string
  location?: string
  note?: string
  cancelled?: boolean
  cancellationNote?: string
  meldungId?: string
  archivedAfter?: string
}

function parseDate(d: string): Date {
  const parts = d.split('.')
  if (parts.length === 3) return new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`)
  return new Date(d)
}

function isArchived(archivedAfter?: string): boolean {
  if (!archivedAfter) return false
  const parts = archivedAfter.split('.')
  if (parts.length !== 3) return false
  return new Date(+parts[2], +parts[1] - 1, +parts[0]) < new Date()
}

function formatDate(d: string) {
  try {
    const parts = d.split('.')
    if (parts.length === 3) {
      const month = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`)
        .toLocaleString('de-DE', { month: 'long' })
      return `${parseInt(parts[0])}. ${month} ${parts[2]}`
    }
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return d }
}

// ─── Live countdown ───────────────────────────────────────────────────────────

interface CD { days: number; hours: number; minutes: number; seconds: number }

function useCountdown(dateStr: string | undefined): CD | null {
  const [cd, setCd] = useState<CD | null>(null)

  useEffect(() => {
    if (!dateStr) return
    const target = parseDate(dateStr)

    function tick() {
      const diff = target.getTime() - Date.now()
      if (diff <= 0) { setCd({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return }
      setCd({
        days:    Math.floor(diff / 86_400_000),
        hours:   Math.floor((diff % 86_400_000) / 3_600_000),
        minutes: Math.floor((diff % 3_600_000)  / 60_000),
        seconds: Math.floor((diff % 60_000)      / 1_000),
      })
    }

    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [dateStr])

  return cd
}

function Digit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 dark:bg-slate-800/80 border border-gray-200 dark:border-white/8 shadow-sm dark:shadow-inner">
        <span className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{String(value).padStart(2, '0')}</span>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-500">{label}</span>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NextConcertSection({ content }: { content: NextConcertContent }) {
  const [next, setNext] = useState<TerminRaw | null | undefined>(undefined)
  const [showMeldung, setShowMeldung] = useState(false)
  const meldungen = useMeldungen()

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)

    if (content.autoFromTermine) {
      fetch(`${API_BASE}/api/termine/konzerte`)
        .then(r => r.ok ? r.json() : [])
        .then((data: TerminRaw[]) => {
          const upcoming = data
            .filter(t => parseDate(t.date) >= today && !isArchived(t.archivedAfter))
            .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime())
          setNext(upcoming[0] ?? null)
        })
        .catch(() => setNext(null))
    } else {
      const upcoming = (content.events ?? [] as TerminRaw[])
        .filter((e: TerminRaw) => parseDate(e.date) >= today && !isArchived(e.archivedAfter))
        .sort((a: TerminRaw, b: TerminRaw) => parseDate(a.date).getTime() - parseDate(b.date).getTime())
      setNext(upcoming[0] ?? null)
    }
  }, [content])

  const cd = useCountdown(next && !next.cancelled ? next.date : undefined)
  const isToday = cd !== null && cd?.days === 0 && cd?.hours === 0 && (cd?.minutes ?? 60) < 60
  const linkedMeldung = next?.meldungId ? getMeldungById(meldungen, next.meldungId) : undefined

  return (
    <section className="relative overflow-hidden bg-gray-50 dark:bg-slate-950 py-20">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className={`absolute -left-40 -top-40 h-80 w-80 rounded-full blur-3xl ${next?.cancelled ? 'bg-red-500/10' : 'bg-green-500/10'}`} />
        <div className={`absolute -bottom-40 -right-40 h-80 w-80 rounded-full blur-3xl ${next?.cancelled ? 'bg-red-500/10' : 'bg-green-500/10'}`} />
      </div>

      <div className="relative mx-auto max-w-3xl px-6">
        {/* Section label */}
        <div className="mb-8 flex items-center gap-3">
          <span className="h-0.5 w-10 bg-green-500 rounded-full" />
          <span className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-400">Nächstes Konzert</span>
        </div>

        {/* Loading skeleton */}
        {next === undefined && (
          <div className="h-40 animate-pulse rounded-2xl bg-gray-200 dark:bg-slate-800/60" />
        )}

        {/* No upcoming concerts */}
        {next === null && (
          <div className="flex items-center gap-4 rounded-2xl border border-gray-200 dark:border-white/8 bg-white dark:bg-slate-900/60 px-6 py-6">
            <span className="text-3xl opacity-30">🎵</span>
            <p className="text-gray-500 dark:text-gray-400">Derzeit sind keine Konzerte geplant.</p>
          </div>
        )}

        {/* Concert card */}
        {next && (
          <div className={`overflow-hidden rounded-2xl border shadow-lg dark:shadow-2xl ${
            next.cancelled
              ? 'border-red-300/40 dark:border-red-800/40 bg-white dark:bg-slate-900/80 opacity-90'
              : 'border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900/80 backdrop-blur-sm'
          }`}>
            {/* Top stripe */}
            <div className={`h-1 w-full ${next.cancelled ? 'bg-red-500' : 'bg-gradient-to-r from-green-500 via-emerald-400 to-green-600'}`} />

            <div className="p-8">
              {/* Header row */}
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h3 className={`text-2xl font-bold leading-tight ${
                      next.cancelled ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'
                    }`}>{next.title}</h3>
                    {next.cancelled && (
                      <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white shrink-0">
                        Abgesagt
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                    {next.location && (
                      <span className="flex items-center gap-1.5">📍 {next.location}</span>
                    )}
                  </div>
                  {next.note && !next.cancelled && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{next.note}</p>
                  )}
                  {next.cancelled && next.cancellationNote && (
                    <p className="mt-2 text-sm text-red-500 dark:text-red-400">{next.cancellationNote}</p>
                  )}
                </div>
                <div className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap ${
                  next.cancelled
                    ? 'bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-white/10 text-gray-400 dark:text-gray-500'
                    : 'bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400'
                }`}>
                  📅 {formatDate(next.date)}
                </div>
              </div>

              {/* Countdown (nur wenn nicht abgesagt) */}
              {!next.cancelled && cd && !isToday && cd.days > 0 && (
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600">Noch</p>
                  <div className="flex items-end gap-3">
                    <Digit value={cd.days}    label="Tage"    />
                    <span className="mb-4 text-xl font-light text-gray-400 dark:text-gray-700">:</span>
                    <Digit value={cd.hours}   label="Std"     />
                    <span className="mb-4 text-xl font-light text-gray-400 dark:text-gray-700">:</span>
                    <Digit value={cd.minutes} label="Min"     />
                    <span className="mb-4 text-xl font-light text-gray-400 dark:text-gray-700">:</span>
                    <Digit value={cd.seconds} label="Sek"     />
                  </div>
                </div>
              )}

              {/* Today / imminent */}
              {!next.cancelled && cd && (isToday || cd.days === 0) && (
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                  </span>
                  <span className="text-lg font-bold text-green-400">
                    {cd.days === 0 && cd.hours === 0 && cd.minutes < 60 ? 'Es ist soweit!' : 'Heute!'}
                  </span>
                </div>
              )}

              {/* Abgesagt: Meldungs-Button */}
              {next.cancelled && linkedMeldung && (
                <button
                  onClick={() => setShowMeldung(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-300/50 dark:border-red-700/50 px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition"
                >
                  ℹ️ Weitere Infos
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showMeldung && linkedMeldung && (
        <MeldungModal meldung={linkedMeldung} onClose={() => setShowMeldung(false)} />
      )}
    </section>
  )
}
