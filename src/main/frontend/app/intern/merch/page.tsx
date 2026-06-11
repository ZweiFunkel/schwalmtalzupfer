'use client'
import { getApiBase } from '@/lib/api'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API_BASE = getApiBase()
const BESTELLFORMULAR_KEY = 'Downloads/Bestellformular-Schwalmtalzupfer.jpg'


function BestellformularModal({ onClose }: { onClose: () => void }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)

  const previewUrl  = `${API_BASE}/api/noten/preview?key=${encodeURIComponent(BESTELLFORMULAR_KEY)}`
  const downloadUrl = `${API_BASE}/api/noten/download?key=${encodeURIComponent(BESTELLFORMULAR_KEY)}`

  useEffect(() => {
    fetch(previewUrl, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error(); return r.blob() })
      .then(blob => setImgSrc(URL.createObjectURL(blob)))
      .catch(() => setError(true))
  }, [previewUrl])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <p className="font-semibold text-white">📋 Bestellformular</p>
          <div className="flex items-center gap-2">
            <a
              href={downloadUrl}
              download="Bestellformular-Schwalmtalzupfer.jpg"
              className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-500 transition"
            >
              ⬇ Herunterladen
            </a>
            <button onClick={onClose} className="px-1 text-xl text-gray-400 hover:text-white transition">✕</button>
          </div>
        </div>

        {/* Inhalt */}
        <div className="flex-1 overflow-auto">
          {error ? (
            <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
              <span className="text-5xl">⚠️</span>
              <p className="text-sm text-gray-300">Bestellformular konnte nicht geladen werden.</p>
              <a href={downloadUrl} download="Bestellformular-Schwalmtalzupfer.jpg"
                className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-500 transition">
                ⬇ Direkt herunterladen
              </a>
            </div>
          ) : !imgSrc ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-pulse text-4xl">📋</div>
                <p className="mt-3 text-sm text-gray-400">Formular wird geladen…</p>
              </div>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imgSrc}
              alt="Bestellformular Schwalmtalzupfer"
              className="w-full object-contain"
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function MerchPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { document.title = 'Merch – Schwalmtalzupfer' }, [])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-gray-400">Laden…</div>
  if (!user) return null

  const downloadUrl = `${API_BASE}/api/noten/download?key=${encodeURIComponent(BESTELLFORMULAR_KEY)}`

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-gray-500">
        <Link href="/intern" className="hover:text-green-400 transition">Intern</Link>
        <span>/</span>
        <span className="text-gray-300">Merch</span>
      </div>

      <h1 className="mb-2 text-3xl font-bold text-white">👕 Merch</h1>
      <p className="mb-10 text-gray-400">Vereinskleidung & Fanartikel der Schwalmtalzupfer</p>


      {/* Bezugsquelle */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-white">Bezugsquelle</h2>
        <div className="rounded-xl border border-white/10 bg-slate-900 p-6">
          <p className="mb-4 text-gray-300 text-sm leading-relaxed">
            Vereinskleidung erhaltet ihr bei:
          </p>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-10">
            {/* Adresse */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-900/30 text-lg">
                🏪
              </div>
              <div>
                <p className="font-bold text-white text-base">Golden Goal Sport &amp; Flock</p>
                <p className="mt-1 text-sm text-gray-400">Hubertusplatz 21</p>
                <p className="text-sm text-gray-400">41334 Nettetal</p>
              </div>
            </div>

            {/* Website */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-900/30 text-lg">
                🌐
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Website</p>
                <a
                  href="https://www.golden-goal.net"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-green-400 hover:text-green-300 transition"
                >
                  www.golden-goal.net
                </a>
              </div>
            </div>

            {/* Maps */}
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-900/30 text-lg">
                📍
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Route</p>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Hubertusplatz+21+41334+Nettetal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-green-400 hover:text-green-300 transition"
                >
                  In Google Maps öffnen
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bestellformular */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">Bestellformular</h2>
        <div className="rounded-xl border border-white/10 bg-slate-900 p-6">
          <p className="mb-5 text-sm text-gray-400 leading-relaxed">
            Das Bestellformular bitte ausgefüllt beim Vorstand abgeben oder direkt bei Golden Goal einreichen.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-500 transition shadow-lg shadow-green-600/20"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m0 0l3-3m-3 3l3 3M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
              </svg>
              Formular ansehen
            </button>
            <a
              href={downloadUrl}
              download="Bestellformular-Schwalmtalzupfer.jpg"
              className="flex items-center gap-2 rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-300 hover:border-green-500/40 hover:text-white transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Herunterladen
            </a>
          </div>
        </div>
      </section>

      {/* Modal */}
      {showForm && <BestellformularModal onClose={() => setShowForm(false)} />}
    </div>
  )
}

