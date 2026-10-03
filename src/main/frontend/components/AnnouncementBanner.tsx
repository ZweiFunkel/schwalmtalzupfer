'use client'
import { T, L, useLanguage } from '@/lib/i18n/LanguageProvider'
import React, { useEffect, useRef, useState } from 'react'
import { getApiBase } from '@/lib/api'
import { Meldung, isMeldungScheduledNow } from '@/lib/useMeldungen'

const API_BASE = getApiBase()
const STORAGE_KEY = 'dismissed_announcements'

const ANNOUNCEMENT_EN: Record<string, string> = {
  'Sommerkonzert 2026 fällt aus!': 'Summer concert 2026 is cancelled!',
  'Liebe Schwalmtalzupfer und Freunde der Schwalmtalzupfer,\n\nseit Monaten proben wir voller Vorfreude für unser großes Sommerkonzert am Sonntag, den 28.06.2026. Ein Sommerkonzert mit viel Sonne klingt zunächst einmal wunderbar. Damit wir jedoch mit rund 300 Schwalmtalzupfern gemeinsam ein Open-Air-Konzert durchführen können, müssen die Rahmenbedingungen stimmen. Leider sind die Wetterprognosen für Sonntag derzeit sehr widersprüchlich. An einem Tag werden 28 Grad vorhergesagt, am nächsten plötzlich 35 Grad. Hinzu kommen mögliche Gewitter, deren Entwicklung sich aktuell nur schwer und oft erst sehr kurzfristig einschätzen lässt. Das birgt Risiken für alle Beteiligten sowie für die technische Ausstattung. Aus diesem Grund sind wir, der Vorstand der Schwalmtalzupfer, gemeinsam mit der Gemeinde Schwalmtal nach sorgfältiger Abwägung zu dem Entschluss gekommen, das Konzert schweren Herzens abzusagen. Die Sicherheit unserer Mitspielerinnen und Mitspieler, unserer Gäste sowie aller Helfer hat für uns oberste Priorität. Diese Entscheidung ist uns nicht leichtgefallen, denn wir hätten sehr gerne für euch gespielt und gemeinsam mit euch einen schönen Sommernachmittag verbracht. Wir danken euch für euer Verständnis und freuen uns darauf, euch spätestens bei unserem Winterkonzert am 4. Advent in der Achim-Besgen-Halle begrüßen zu dürfen. Dort tauschen wir Sonnencreme und Hitzewarnungen ganz entspannt gegen Weihnachtsstimmung und warme Getränke ein.\n\nEure Schwalmtalzupfer': 'Dear Schwalmtalzupfer members and friends,\n\nFor months, we have been rehearsing excitedly for our big summer concert on Sunday, 28 June 2026. A summer concert with plenty of sunshine sounds wonderful at first. However, to perform an open-air concert together with around 300 Schwalmtalzupfer members, the conditions have to be right. Unfortunately, the weather forecasts for Sunday are currently very inconsistent. One day predicts 28 degrees, the next suddenly 35 degrees. There is also a risk of thunderstorms, whose development is difficult to predict and often only becomes clear at very short notice. This poses risks for everyone involved as well as for the technical equipment.\n\nFor this reason, after careful consideration, the Schwalmtalzupfer board and the municipality of Schwalmtal have decided, with heavy hearts, to cancel the concert. The safety of our players, guests and helpers is our highest priority. This decision was not easy, as we would have loved to play for you and spend a wonderful summer afternoon together. Thank you for your understanding. We look forward to welcoming you at the latest at our winter concert on the fourth Sunday of Advent in the Achim-Besgen-Halle. We will gladly swap sunscreen and heat warnings for Christmas spirit and hot drinks.\n\nYour Schwalmtalzupfer',
}

function announcementText(value: string | undefined, language: string): string {
  if (language !== 'en' || !value) return value ?? ''
  const direct = ANNOUNCEMENT_EN[value]
  if (direct) return direct
  const normalize = (text: string) => text.replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-').trim()
  const normalized = normalize(value)
  const match = Object.entries(ANNOUNCEMENT_EN).find(([source]) => normalize(source) === normalized)
  return match?.[1] ?? value
}

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
  const { language } = useLanguage()
  const cfg = MELDUNG_STYLE[meldung.style ?? 'warning']
  const title = announcementText(meldung.text, language)
  const body = announcementText(meldung.body, language)

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
          <p className="flex-1 text-base font-semibold text-white leading-snug">{title}</p>
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
              <L as="img" src={meldung.imageUrl} alt={meldung.title}
                className="w-full object-cover max-h-64 sm:max-h-80" />
            )}
            {body && (
              <div className="px-5 py-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">{body}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 dark:border-white/10 px-5 py-3">
          <button onClick={onClose}
            className="rounded-full border border-gray-200 dark:border-white/15 px-4 py-2 text-xs font-semibold text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white transition"><T value={" Schließen "} /></button>
        </div>
      </div>
    </div>
  )
}

export default function AnnouncementBanner() {
  const { language } = useLanguage()
  const [ann, setAnn]         = useState<Meldung | null>(null)
  const [mounted, setMounted] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/site/settings`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : {})
      .then((settings: Record<string, string>) => {
        // 1. Neue Meldungen-Array-Logik
        if (settings.meldungen) {
          try {
            const list: Meldung[] = JSON.parse(settings.meldungen)
            // Scheduled Meldungen haben Vorrang – nimm die mit dem spätesten validFrom
            const scheduled = list
              .filter(m => isMeldungScheduledNow(m) && !getDismissed().includes(m.id))
              .sort((a, b) => {
                const da = a.validFrom ? a.validFrom.split('.').reverse().join('') : '0'
                const db = b.validFrom ? b.validFrom.split('.').reverse().join('') : '0'
                return db.localeCompare(da)
              })
            const active = scheduled[0] ?? list.find(m => m.activeForBanner && !m.validFrom && !m.validUntil && !getDismissed().includes(m.id))
            if (active) {
              setAnn(active)
              timerRef.current = setTimeout(() => setMounted(true), 20)
            }
            // The current list is authoritative, even when empty or expired.
            // Never resurrect a legacy announcement in that case.
            return
          } catch { /* ignore */ }
        }
        // 2. Fallback: altes announcement-Format
        if (settings.announcement) {
          try {
            const parsed = JSON.parse(settings.announcement) as Meldung & { active?: boolean }
            if (parsed.active && (!(parsed.validFrom || parsed.validUntil) || isMeldungScheduledNow(parsed)) && !getDismissed().includes(parsed.id)) {
              setAnn(parsed)
              timerRef.current = setTimeout(() => setMounted(true), 20)
            }
          } catch { /* ignore */ }
        }
      })
      .catch(() => {})
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  useEffect(() => {
    const checkExpiry = () => {
      if (ann && (ann.validFrom || ann.validUntil) && !isMeldungScheduledNow(ann)) {
        setAnn(null)
        setMounted(false)
        setShowModal(false)
      }
    }
    checkExpiry()
    const interval = window.setInterval(checkExpiry, 1000)
    window.addEventListener('focus', checkExpiry)
    document.addEventListener('visibilitychange', checkExpiry)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', checkExpiry)
      document.removeEventListener('visibilitychange', checkExpiry)
    }
  }, [ann])

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
            {announcementText(ann.text, language)}
          </p>

          {hasBody ? (
            <button
              onClick={() => setShowModal(true)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${cfg.pillBg} ${cfg.pillText} whitespace-nowrap border border-white/20`}
            ><T value={" Weitere Infos "} /></button>
          ) : null}

          <L as="button" onClick={handleDismiss} title="Ausblenden"
            className={`shrink-0 rounded-full p-1.5 transition ${cfg.subCl} hover:bg-white/20`}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </L>
        </div>
      </div>

      {showModal && (
        <MeldungModal meldung={ann} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}
