'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SectionResolver from '@/components/SectionResolver'
import { getApiBase } from '@/lib/api'
import { PageSection } from '@/types/page'

const API_BASE = getApiBase()

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

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-gray-400">Laden…</div>
  if (!user) return null

  const displayName = [user.vorname, user.nachname].filter(Boolean).join(' ') || user.username || user.email

  return (
    <>
    <div className="mx-auto max-w-5xl px-6 py-12">
      {/* Willkommen */}
      <div className="mb-10 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 p-8">
        <p className="mb-1 text-sm font-medium uppercase tracking-widest text-green-400">Interner Bereich</p>
        <h1 className="text-3xl font-bold text-white">
          Willkommen, {displayName}! 👋
        </h1>
        <p className="mt-2 text-gray-400">
          Herzlich willkommen im Internen Bereich der Schwalmtalzupfer. Hier findest du alles für Mitglieder.
        </p>
      </div>

      {/* Schnelllinks */}
      <div className="grid gap-5 sm:grid-cols-3">
        <Link
          href="/intern/videos"
          className="group flex flex-col gap-4 rounded-xl border border-white/10 bg-slate-900 p-6 hover:border-green-500/40 hover:bg-slate-800/80 transition"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-900/30 text-2xl group-hover:bg-green-900/50 transition">
            🎬
          </div>
          <div>
            <p className="font-semibold text-white">Videos</p>
            <p className="mt-1 text-sm text-gray-400 leading-relaxed">
              Sommerkonzerte, Winterkonzerte und weitere Auftritte direkt eingebettet.
            </p>
          </div>
          <div className="mt-auto flex items-center gap-1 text-xs font-medium text-green-500 group-hover:text-green-400 transition">
            <span>Zu den Videos</span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <Link
          href="/intern/merch"
          className="group flex flex-col gap-4 rounded-xl border border-white/10 bg-slate-900 p-6 hover:border-green-500/40 hover:bg-slate-800/80 transition"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-900/30 text-2xl group-hover:bg-green-900/50 transition">
            👕
          </div>
          <div>
            <p className="font-semibold text-white">Merch</p>
            <p className="mt-1 text-sm text-gray-400 leading-relaxed">
              Vereinskleidung & Fanartikel – mit Bestellformular.
            </p>
          </div>
          <div className="mt-auto flex items-center gap-1 text-xs font-medium text-green-500 group-hover:text-green-400 transition">
            <span>Zum Merch</span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        <Link
          href="/noten"
          className="group flex flex-col gap-4 rounded-xl border border-white/10 bg-slate-900 p-6 hover:border-green-500/40 hover:bg-slate-800/80 transition"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-900/30 text-2xl group-hover:bg-green-900/50 transition">
            🎼
          </div>
          <div>
            <p className="font-semibold text-white">Notenarchiv</p>
            <p className="mt-1 text-sm text-gray-400 leading-relaxed">
              Noten herunterladen, suchen und als ZIP exportieren.
            </p>
          </div>
          <div className="mt-auto flex items-center gap-1 text-xs font-medium text-green-500 group-hover:text-green-400 transition">
            <span>Zum Notenarchiv</span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>
    </div>

    {/* CMS sections (e.g. INTERN_CHANGELOG) */}
    {cmsSections.length > 0 && (
      <div className="mx-auto max-w-5xl px-6 pb-12">
        {cmsSections.map(s => (
          <SectionResolver key={s.id} section={s} />
        ))}
      </div>
    )}
    </>
  )
}
