'use client'
import React, { useEffect, useRef, useState } from 'react'
import { getApiBase } from '@/lib/api'

const API_BASE = getApiBase()
const STORAGE_KEY = 'dismissed_announcements'

interface Announcement {
  id: string
  text: string
  link?: string
  linkLabel?: string
  body?: string   // langer Beitragstext — öffnet Modal statt externem Link
  style?: 'info' | 'warning' | 'success'
  active: boolean
}

interface StyleCfg {
  bg: string; border: string; iconBg: string; icon: string; text: string; pillBg: string; modalBorder: string
}

const STYLE_CONFIG: Record<string, StyleCfg> = {
  info: {
    bg: 'bg-slate-900/98', border: 'border-blue-500/25', iconBg: 'bg-blue-500/15 text-blue-400',
    icon: '💡', text: 'text-slate-200', pillBg: 'bg-blue-600 hover:bg-blue-500', modalBorder: 'border-blue-500/30',
  },
  warning: {
    bg: 'bg-slate-900/98', border: 'border-amber-500/25', iconBg: 'bg-amber-500/15 text-amber-400',
    icon: '⚡', text: 'text-slate-200', pillBg: 'bg-amber-600 hover:bg-amber-500', modalBorder: 'border-amber-500/30',
  },
  success: {
    bg: 'bg-slate-900/98', border: 'border-green-500/25', iconBg: 'bg-green-500/15 text-green-400',
    icon: '🎉', text: 'text-slate-200', pillBg: 'bg-green-600 hover:bg-green-500', modalBorder: 'border-green-500/30',
  },
}

function getDismissed(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function dismiss(id: string) {
  const list = getDismissed()
  if (!list.includes(id)) list.push(id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

function AnnouncementModal({ ann, cfg, onClose }: { ann: Announcement; cfg: StyleCfg; onClose: () => void }) {
  // Schließen mit Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`relative w-full max-w-lg rounded-2xl border ${cfg.modalBorder} bg-slate-900 shadow-2xl`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center gap-3 rounded-t-2xl border-b ${cfg.border} px-6 py-4`}>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${cfg.iconBg}`}>
            {cfg.icon}
          </div>
          <p className="flex-1 text-base font-semibold text-white">{ann.text}</p>
          <button onClick={onClose} className="shrink-0 rounded-full p-1.5 text-white/40 hover:text-white hover:bg-white/10 transition">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Beitragstext */}
        <div className="px-6 py-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{ann.body}</p>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-end gap-3 rounded-b-2xl border-t ${cfg.border} px-6 py-4`}>
          {ann.link && (
            <a href={ann.link} target="_blank" rel="noopener noreferrer"
              className={`rounded-full px-4 py-2 text-xs font-semibold text-white transition ${cfg.pillBg}`}>
              {ann.linkLabel ?? 'Mehr Infos →'}
            </a>
          )}
          <button onClick={onClose} className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/70 hover:text-white hover:border-white/30 transition">
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AnnouncementBanner() {
  const [ann, setAnn]         = useState<Announcement | null>(null)
  const [mounted, setMounted] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/site/settings`)
      .then(r => r.ok ? r.json() : {})
      .then((settings: Record<string, string>) => {
        if (!settings.announcement) return
        try {
          const parsed: Announcement = JSON.parse(settings.announcement)
          if (!parsed.active) return
          if (getDismissed().includes(parsed.id)) return
          setAnn(parsed)
          timerRef.current = setTimeout(() => setMounted(true), 20)
        } catch { /* invalid JSON */ }
      })
      .catch(() => {})
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  if (!ann) return null

  const cfg = STYLE_CONFIG[ann.style ?? 'info']
  const hasBody = !!ann.body?.trim()

  const handleDismiss = () => {
    setMounted(false)
    setTimeout(() => { dismiss(ann.id); setAnn(null) }, 300)
  }

  const handlePillClick = () => {
    if (hasBody) setShowModal(true)
  }

  return (
    <>
      <div
        className={`w-full border-b backdrop-blur-md ${cfg.bg} ${cfg.border} transition-all duration-300 overflow-hidden`}
        style={{ maxHeight: mounted ? '80px' : '0', opacity: mounted ? 1 : 0 }}
      >
        <div className="mx-auto max-w-6xl flex items-center gap-3 px-4 py-2.5">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${cfg.iconBg}`}>
            {cfg.icon}
          </div>

          <p className={`flex-1 text-sm font-medium leading-snug ${cfg.text}`}>{ann.text}</p>

          {/* Pill: öffnet Modal (body) oder externen Link */}
          {hasBody ? (
            <button
              onClick={handlePillClick}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white transition ${cfg.pillBg} whitespace-nowrap`}
            >
              {ann.linkLabel ?? 'Details →'}
            </button>
          ) : ann.link ? (
            <a href={ann.link} target="_blank" rel="noopener noreferrer"
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white transition ${cfg.pillBg} whitespace-nowrap`}>
              {ann.linkLabel ?? 'Mehr →'}
            </a>
          ) : null}

          <button onClick={handleDismiss} title="Ausblenden"
            className="shrink-0 rounded-full p-1.5 text-white/30 hover:text-white hover:bg-white/10 transition">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {showModal && ann.body && (
        <AnnouncementModal ann={ann} cfg={cfg} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}
