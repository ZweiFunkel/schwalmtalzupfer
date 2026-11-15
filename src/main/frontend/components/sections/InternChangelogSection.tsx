'use client'

import { T } from '@/lib/i18n/LanguageProvider'
import React, { useEffect, useState } from 'react'
import { getApiBase } from '@/lib/api'
import Link from 'next/link'
import { InternChangelogContent, InternChangelogEntry, InternChangelogEntryType } from '@/types/page'

interface TypeCfg {
  label: string
  dot: string
  badge: string
  badgeText: string
}

const TYPE_CONFIG: Record<InternChangelogEntryType, TypeCfg> = {
  new:    { label: 'Neu',    dot: 'bg-green-500', badge: 'bg-green-100 border-green-400/50 dark:bg-green-900/40 dark:border-green-500/30', badgeText: 'text-green-700 dark:text-green-400' },
  update: { label: 'Update', dot: 'bg-amber-500', badge: 'bg-amber-100 border-amber-400/50 dark:bg-amber-900/40 dark:border-amber-500/30', badgeText: 'text-amber-700 dark:text-amber-400' },
  fix:    { label: 'Fix',    dot: 'bg-red-500',   badge: 'bg-red-100 border-red-400/50 dark:bg-red-900/40 dark:border-red-500/30',   badgeText: 'text-red-700 dark:text-red-400' },
  info:   { label: 'Info',   dot: 'bg-blue-500',  badge: 'bg-blue-100 border-blue-400/50 dark:bg-blue-900/40 dark:border-blue-500/30', badgeText: 'text-blue-700 dark:text-blue-400' },
}

interface AutoVideo { id: string; title: string; type: string; youtubeId?: string | null; releaseAt?: string | null; createdAt?: string | null; released?: boolean }

const AUTO_DAYS = 14
const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
function parseDe(s: string): number {
  const m = /^(d{2}).(d{2}).(d{4})/.exec(s.trim())
  return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : 0
}

/** Neue/kommende Videos erscheinen automatisch in "Was ist neu?" (keine Handarbeit). */
function useAutoVideoEntries(): (InternChangelogEntry & { _t: number })[] {
  const [auto, setAuto] = useState<(InternChangelogEntry & { _t: number })[]>([])
  useEffect(() => {
    fetch(`${getApiBase()}/api/intern/videos`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((videos: AutoVideo[]) => {
        const now = Date.now()
        const out: (InternChangelogEntry & { _t: number })[] = []
        for (const v of videos) {
          const stamp = v.releaseAt || v.createdAt
          if (!stamp) continue
          const d = new Date(stamp)
          const t = d.getTime()
          if (Number.isNaN(t)) continue
          if (v.released === false) {
            if (!v.releaseAt || t <= now) continue
            out.push({ _t: t, date: fmt(d), type: 'info', title: `Demnächst: ${v.title}`,
              content: `Wird am ${fmt(d)} um ${pad(d.getHours())}:${pad(d.getMinutes())} Uhr freigeschaltet.`, link: '/intern/videos' })
          } else if (t <= now && now - t <= AUTO_DAYS * 86400000) {
            out.push({ _t: t, date: fmt(d), type: 'new', title: v.title,
              content: 'Neues Video wurde hinzugefügt!', link: v.youtubeId ? `/intern/videos?v=${v.youtubeId}` : '/intern/videos' })
          }
        }
        setAuto(out)
      })
      .catch(() => {})
  }, [])
  return auto
}

export default function InternChangelogSection({ content }: { content: InternChangelogContent }) {
  const auto = useAutoVideoEntries()
  const entries: InternChangelogEntry[] = [
    ...auto.map(({ _t, ...e }) => ({ ...e, _t })),
    ...(content.entries ?? []).map(e => ({ ...e, _t: parseDe(e.date) })),
  ].sort((a, b) => (b as { _t: number })._t - (a as { _t: number })._t)

  return (
    <section className="py-10 px-6">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <div className="h-0.5 w-8 rounded-full bg-green-500" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            <T value={content.heading ?? 'Was ist neu?'} />
          </h2>
        </div>

        {entries.length === 0 && (
          <p className="text-sm text-gray-500 italic"><T value={"Noch keine Einträge vorhanden."} /></p>
        )}

        {/* Timeline */}
        <div className="relative flex flex-col gap-0">
          {/* Vertical line */}
          {entries.length > 0 && (
            <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200 dark:bg-white/10" />
          )}

          {entries.map((entry, i) => {
            const cfg = TYPE_CONFIG[entry.type ?? 'info']
            return (
              <div key={i} className="relative flex gap-5 pb-7 last:pb-0">
                {/* Dot */}
                <div className={`relative z-10 mt-1 h-6 w-6 shrink-0 rounded-full border-2 border-white dark:border-slate-900 ${cfg.dot} flex items-center justify-center`} />

                {/* Card */}
                <div className="flex-1 rounded-xl border border-gray-200 dark:border-white/8 bg-white dark:bg-slate-800/40 p-4 shadow-sm dark:shadow-none">
                  <div className="flex flex-wrap items-start gap-2 mb-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cfg.badge} ${cfg.badgeText}`}>
                      <T value={cfg.label} />
                    </span>
                    {entry.link ? (
                      entry.link.startsWith('http://') || entry.link.startsWith('https://') ? (
                        <a href={entry.link} target="_blank" rel="noopener noreferrer"
                          className="font-semibold text-gray-900 dark:text-white text-sm leading-snug hover:text-green-600 dark:hover:text-green-400 hover:underline transition">
                          <T value={entry.title} />
                        </a>
                      ) : (
                        <Link href={entry.link}
                          className="font-semibold text-gray-900 dark:text-white text-sm leading-snug hover:text-green-600 dark:hover:text-green-400 hover:underline transition">
                          <T value={entry.title} />
                        </Link>
                      )
                    ) : (
                      <span className="font-semibold text-gray-900 dark:text-white text-sm leading-snug"><T value={entry.title} /></span>
                    )}
                    <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 shrink-0">{entry.date}</span>
                  </div>
                  {entry.content && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                      {entry.content}
                    </p>
                  )}
                  {entry.link && (
                    <Link href={entry.link}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 hover:underline"><T value={" Ansehen "} /><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </Link>
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
