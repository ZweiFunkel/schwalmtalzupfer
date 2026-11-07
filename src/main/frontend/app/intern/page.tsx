'use client'
import { T } from '@/lib/i18n/LanguageProvider'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SectionResolver from '@/components/SectionResolver'
import { getApiBase } from '@/lib/api'
import { PageSection } from '@/types/page'

const API_BASE = getApiBase()

const NOTICE_DAYS = 7
const NOTICE_STORE = 'video_notices_dismissed'

interface ReleasedVideo { id: string; category: string; year: string | null; subcategory: string | null; title: string; releaseAt?: string | null; released?: boolean }

/** Gruppiert frisch freigegebene Videos (z. B. alle Tage eines Winterkonzerts) zu einer Meldung. */
function noticeFor(v: ReleasedVideo): { key: string; label: string } {
  if (v.category === 'WINTER') return { key: `WINTER-${v.year}`, label: `Winterkonzert ${v.year ?? ''}`.trim() }
  if (v.category === 'SOMMER') return { key: `SOMMER-${v.year}`, label: `Sommerkonzert ${v.year ?? ''}`.trim() }
  return { key: `WEITERE-${v.subcategory ?? v.title}`, label: v.subcategory || v.title }
}

/** Einmalige Info fuer eine Woche nach der automatischen Freigabe; mit "x" dauerhaft weg (pro Browser). */
function NewVideoNotice() {
  const [notices, setNotices] = useState<{ key: string; label: string }[]>([])

  useEffect(() => {
    let dismissed: string[] = []
    try { dismissed = JSON.parse(localStorage.getItem(NOTICE_STORE) || '[]') } catch { /* ignore */ }
    fetch(`${API_BASE}/api/intern/videos`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((videos: ReleasedVideo[]) => {
        const now = Date.now()
        const found = new Map<string, string>()
        for (const v of videos) {
          if (v.released === false || !v.releaseAt) continue
          const at = new Date(v.releaseAt).getTime()
          if (Number.isNaN(at) || at > now || now - at > NOTICE_DAYS * 86400000) continue
          const n = noticeFor(v)
          if (!dismissed.includes(n.key)) found.set(n.key, n.label)
        }
        setNotices([...found].map(([key, label]) => ({ key, label })))
      })
      .catch(() => {})
  }, [])

  const dismiss = (key: string) => {
    setNotices(n => n.filter(x => x.key !== key))
    try {
      const cur: string[] = JSON.parse(localStorage.getItem(NOTICE_STORE) || '[]')
      localStorage.setItem(NOTICE_STORE, JSON.stringify([...cur, key].slice(-50)))
    } catch { /* ignore */ }
  }

  if (notices.length === 0) return null
  return (
    <div className="mb-8 space-y-3">
      {notices.map(n => (
        <div key={n.key} className="flex items-center gap-4 rounded-xl border border-green-500/40 bg-green-50 dark:bg-green-900/20 px-5 py-4">
          <span className="text-2xl" aria-hidden>🎬</span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 dark:text-white"><T value={"Neu freigeschaltet:"} /> {n.label}</p>
            <Link href="/intern/videos" className="text-sm font-medium text-green-700 dark:text-green-400 hover:underline"><T value={"Jetzt ansehen →"} /></Link>
          </div>
          <button type="button" onClick={() => dismiss(n.key)} aria-label="Schließen"
            className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-black/5 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white transition">✕</button>
        </div>
      ))}
    </div>
  )
}

export default function InternPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [cmsSections, setCmsSections] = useState<PageSection[]>([])

  useEffect(() => { document.title = 'Intern – Schwalmtalzupfer' }, [])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    fetch(`${API_BASE}/api/pages/intern`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(p => { if (p?.sections) setCmsSections([...p.sections].sort((a: PageSection, b: PageSection) => a.position - b.position)) })
      .catch(() => {})
  }, [user])

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-gray-400"><T value={"Laden…"} /></div>
  if (!user) return null

  const displayName = [user.vorname, user.nachname].filter(Boolean).join(' ') || user.username || user.email

  return (
    <>
    <div className="mx-auto max-w-7xl px-6 py-12">
      {/* Willkommen */}
      <div className="mb-10 rounded-2xl border border-gray-200 dark:border-white/10 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-slate-900 dark:to-slate-800 p-8">
        <p className="mb-1 text-sm font-medium uppercase tracking-widest text-green-600 dark:text-green-400"><T value={"Interner Bereich"} /></p>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white"><T value={" Willkommen, "} />{displayName}! 👋
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400"><T value={" Herzlich willkommen im Internen Bereich der Schwalmtalzupfer. Hier findest du alles für Mitglieder. "} /></p>
      </div>

      <NewVideoNotice />

      {/* Schnelllinks */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/intern/kalender"
          className="group flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 hover:border-green-500/40 hover:bg-gray-50 dark:hover:bg-slate-800/80 transition"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30 text-2xl group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition">
            🗓️
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white"><T value={"Kalender"} /></p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed"><T value={" Alle Termine & Unterrichtsstunden in Monats-, Wochen- oder Tagesansicht. "} /></p>
          </div>
          <div className="mt-auto flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-500 group-hover:text-green-500 dark:group-hover:text-green-400 transition">
            <span><T value={"Zum Kalender"} /></span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <Link
          href="/intern/videos"
          className="group flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 hover:border-green-500/40 hover:bg-gray-50 dark:hover:bg-slate-800/80 transition"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30 text-2xl group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition">
            🎬
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white"><T value={"Videos"} /></p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed"><T value={" Sommerkonzerte, Winterkonzerte und weitere Auftritte direkt eingebettet. "} /></p>
          </div>
          <div className="mt-auto flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-500 group-hover:text-green-500 dark:group-hover:text-green-400 transition">
            <span><T value={"Zu den Videos"} /></span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <Link
          href="/intern/merch"
          className="group flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 hover:border-green-500/40 hover:bg-gray-50 dark:hover:bg-slate-800/80 transition"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30 text-2xl group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition">
            👕
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white"><T value={"Merch"} /></p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed"><T value={" Vereinskleidung & Fanartikel – mit Bestellformular. "} /></p>
          </div>
          <div className="mt-auto flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-500 group-hover:text-green-500 dark:group-hover:text-green-400 transition">
            <span><T value={"Zum Merch"} /></span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <Link
          href="/galerie-intern"
          className="group flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 hover:border-green-500/40 hover:bg-gray-50 dark:hover:bg-slate-800/80 transition"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30 text-2xl group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition">
            🖼️
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white"><T value={"Interne Galerie"} /></p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed"><T value={" Fotos nur für Mitglieder – nicht öffentlich einsehbar. "} /></p>
          </div>
          <div className="mt-auto flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-500 group-hover:text-green-500 dark:group-hover:text-green-400 transition">
            <span><T value={"Zur Galerie"} /></span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <Link
          href="/noten"
          className="group flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900 p-6 hover:border-green-500/40 hover:bg-gray-50 dark:hover:bg-slate-800/80 transition"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30 text-2xl group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition">
            🎼
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white"><T value={"Notenarchiv"} /></p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed"><T value={" Noten herunterladen, suchen und als ZIP exportieren. "} /></p>
          </div>
          <div className="mt-auto flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-500 group-hover:text-green-500 dark:group-hover:text-green-400 transition">
            <span><T value={"Zum Notenarchiv"} /></span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>
    </div>

    {/* CMS sections (e.g. INTERN_CHANGELOG) */}
    {cmsSections.length > 0 && (
      <div className="mx-auto max-w-7xl px-6 pb-12">
        {cmsSections.map(s => (
          <SectionResolver key={s.id} section={s} />
        ))}
      </div>
    )}
    </>
  )
}
