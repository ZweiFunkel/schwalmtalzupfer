'use client'

import React, { useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const YOUTUBE_EMBEDS = [
  { id: 'dQw4w9WgXcQ', title: 'Probenaufnahme – Frühling 2025' },
  { id: '3JZ_D3ELwOQ', title: 'Weihnachtskonzert 2024 – Highlight' },
]

export default function InternPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-gray-400">Laden…</div>
  if (!user) return null

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold text-white">Interner Bereich</h1>
      <p className="mb-8 text-gray-400">Willkommen, {[user.vorname, user.nachname].filter(Boolean).join(' ') || user.username || user.email}! Hier findest du interne Inhalte.</p>

      {/* Schnelllinks */}
      <div className="mb-10 grid gap-4 sm:grid-cols-3">
        <Link href="/profil"
          className="rounded-xl border border-white/10 bg-slate-900 p-5 hover:border-green-500/40 transition">
          <div className="text-2xl mb-2">👤</div>
          <div className="font-semibold text-white">Mein Profil</div>
          <div className="text-sm text-gray-400 mt-1">Daten einsehen & bearbeiten</div>
        </Link>
        <Link href="/noten"
          className="rounded-xl border border-white/10 bg-slate-900 p-5 hover:border-green-500/40 transition">
          <div className="text-2xl mb-2">🎼</div>
          <div className="font-semibold text-white">Noten</div>
          <div className="text-sm text-gray-400 mt-1">Download für Mitglieder</div>
        </Link>
        <div className="rounded-xl border border-white/10 bg-slate-900 p-5">
          <div className="text-2xl mb-2">📅</div>
          <div className="font-semibold text-white">Probenplan</div>
          <div className="text-sm text-gray-400 mt-1">Freitags 19:30 Uhr, Waldniel</div>
        </div>
      </div>

      {/* Galerie / Videos */}
      <section>
        <h2 className="mb-4 text-xl font-bold text-white">Videos & Aufnahmen</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {YOUTUBE_EMBEDS.map(v => (
            <div key={v.id} className="overflow-hidden rounded-xl border border-white/10 bg-slate-900">
              <div className="relative aspect-video">
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${v.id}`}
                  title={v.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <p className="px-4 py-3 text-sm text-gray-300">{v.title}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

