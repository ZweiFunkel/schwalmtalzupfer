'use client'
import React, { useEffect, useRef, useState } from 'react'
import { getApiBase } from '@/lib/api'
import { Meldung } from '@/lib/useMeldungen'

const API_BASE = getApiBase()
const STORAGE_KEY = 'dismissed_announcements'

export const MELDUNG_STYLE: Record<string, {
  banner: string; icon: string; textCl: string; subCl: string; pillBg: string; pillText: string
  modalHeader: string
}> = {
  info: {
    banner:      'bg-blue-600',
    icon:        'ℹ️',
    textCl:      'text-white',
    subCl:       'text-blue-100',
    pillBg:      'bg-white/20 hover:bg-white/30',
    pillText:    'text-white',
    modalHeader: 'bg-blue-600',
  },
  warning: {
    banner:      'bg-amber-500',
    icon:        '⚠️',
    textCl:      'text-white',
    subCl:       'text-amber-100',
    pillBg:      'bg-white/20 hover:bg-white/30',
    pillText:    'text-white',
    modalHeader: 'bg-amber-500',
  },
  success: {
    banner:      'bg-green-600',
    icon:        '🎉',
    textCl:      'text-white',
    subCl:       'text-green-100',
    pillBg:      'bg-white/20 hover:bg-white/30',
    pillText:    'text-white',
    modalHeader: 'bg-green-600',
  },
}

function getDismissed(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}
function saveDismissed(id: string) {
  const list = getDismissed()
  if (!list.includes(id)) list.push(id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function MeldungModal({ meldung, onClose }: { meldung: Meldung; onClose: () => void }) {
  const cfg = MELDUNG_STYLE[meldung.style ?? 'warning']

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="announcement-modal relative w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col max-h-[90dvh]"
        onClick={e => e.stopPropagation()}
      >
        <div className={`flex items-start gap-3 rounded-t-2xl px-5 py-4 ${cfg.modalHeader}`}>
          <span className="text-2xl mt-0.5">{cfg.icon}</span>
          <div className="flex-1 min-w-0">
            {meldung.title && (
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-0.5">{meldung.title}</p>
            )}
            <p className="text-base font-semibold text-white leading-snug">{meldung.text}</p>
          </div>
          <button onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-white/60 hover:text-white hover:bg-white/15 transition mt-0.5">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {(meldung.imageUrl || meldung.body) && (
          <div className="overflow-y-auto flex-1">
            {meldung.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={meldung.imageUrl} alt={meldung.title}
                className="w-full object-cover max-h-64 sm:max-h-80" />
            )}
            {meldung.body && (
              <div className="px-5 py-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">{meldung.body}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 dark:border-white/10 px-5 py-3">
          <button onClick={onClose}
            className="rounded-full border border-gray-200 dark:border-white/15 px-4 py-2 text-xs font-semibold text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white transition">
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AnnouncementBanner() {
  const [ann, setAnn]         = useState<Meldung | null>(null)
  const [mounted, setMounted] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/site/settings`)
      .then(r => r.ok ? r.json() : {})
      .then((settings: Record<string, string>) => {
        // 1. Neue Meldungen-Array-Logik
        if (settings.meldungen) {
          try {
            const list: Meldung[] = JSON.parse(settings.meldungen)
            const active = list.find(m => m.activeForBanner)
            if (active && !getDismissed().includes(active.id)) {
              setAnn(active)
              timerRef.current = setTimeout(() => setMounted(true), 20)
              return
            }
          } catch { /* ignore */ }
        }
        // 2. Fallback: altes announcement-Format
        if (settings.announcement) {
          try {
            const parsed = JSON.parse(settings.announcement) as Meldung & { active?: boolean }
            if (parsed.active && !getDismissed().includes(parsed.id)) {
              setAnn(parsed)
              timerRef.current = setTimeout(() => setMounted(true), 20)
            }
          } catch { /* ignore */ }
        }
      })
      .catch(() => {})
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  if (!ann) return null

  const cfg = MELDUNG_STYLE[ann.style ?? 'warning']
  const hasBody = !!ann.body?.trim()

  const handleDismiss = () => {
    setMounted(false)
    setTimeout(() => { saveDismissed(ann.id); setAnn(null) }, 300)
  }

  return (
    <>
      <div
        className={`announcement-banner w-full ${cfg.banner} transition-all duration-300 overflow-hidden`}
        style={{ maxHeight: mounted ? '80px' : '0', opacity: mounted ? 1 : 0 }}
      >
        <div className="mx-auto max-w-6xl flex items-center gap-3 px-4 py-3">
          <span className="text-lg shrink-0">{cfg.icon}</span>

          <p className={`flex-1 text-sm font-semibold leading-snug ${cfg.textCl}`}>
            {ann.text}
          </p>

          {hasBody ? (
            <button
              onClick={() => setShowModal(true)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${cfg.pillBg} ${cfg.pillText} whitespace-nowrap border border-white/20`}
            >
              Weitere Infos
            </button>
          ) : null}

          <button onClick={handleDismiss} title="Ausblenden"
            className={`shrink-0 rounded-full p-1.5 transition ${cfg.subCl} hover:bg-white/20`}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {showModal && (
        <MeldungModal meldung={ann} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}
