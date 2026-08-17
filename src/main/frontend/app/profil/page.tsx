'use client'
import { getApiBase } from '@/lib/api'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth'
import { useRouter } from 'next/navigation'

const API_BASE = getApiBase()

export default function ProfilPage() {
  const { user, loading, refresh } = useAuth()
  const router = useRouter()
  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { document.title = 'Profil – Schwalmtalzupfer' }, [])

  useEffect(() => {
    if (!loading && !user) router.push('/login')
    // GUEST role users (like zupf/zupf) cannot access their profile - redirect to intern
    if (user && user.role === 'ROLE_GUEST') {
      router.push('/intern')
    }
    if (user && user.role !== 'ROLE_GUEST') {
      setVorname(user.vorname || '')
      setNachname(user.nachname || '')
    }
  }, [user, loading, router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await fetch(`${API_BASE}/api/member/me`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vorname, nachname }),
    })
    await refresh()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-gray-400">Laden…</div>
  if (!user) return null

  const roleLabel: Record<string, string> = {
    ROLE_GUEST: 'Gast',
    ROLE_MEMBER: 'Mitglied',
    ROLE_BOARD: 'Vorstand',
    ROLE_ADMIN: 'Administrator',
  }

  const displayName = [user.vorname, user.nachname].filter(Boolean).join(' ') || user.username || user.email
  const gruppe = (user as any).gruppe

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="mb-8 text-3xl font-bold text-white">Mein Profil</h1>

      {/* Übersichtskarte */}
      <div className="mb-6 rounded-xl border border-white/10 bg-slate-900 p-6">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-2xl font-bold text-white">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-white">{displayName}</p>
            <p className="text-sm text-gray-400">{user.email || user.username}</p>
            <span className="mt-1 inline-block rounded-full bg-green-900/40 px-2 py-0.5 text-xs text-green-400">
              {roleLabel[user.role] ?? user.role}
            </span>
          </div>
        </div>
      </div>

      {/* Gruppeninformation (nur Lesezugriff) */}
      {gruppe ? (
        <div className="mb-6 rounded-xl border border-white/10 bg-slate-900 p-6">
          <h2 className="mb-3 text-lg font-semibold text-white">Meine Gitarrengruppe</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-400">Wochentag</p>
              <p className="text-white font-medium">{gruppe.wochentag}</p>
            </div>
            <div>
              <p className="text-gray-400">Uhrzeit</p>
              <p className="text-white font-medium">{gruppe.vonUhrzeit} – {gruppe.bisUhrzeit} Uhr</p>
            </div>
            {gruppe.location && (
              <>
                <div>
                  <p className="text-gray-400">Ort</p>
                  <p className="text-white font-medium">{gruppe.location.name}</p>
                </div>
                <div>
                  <p className="text-gray-400">Adresse</p>
                  {gruppe.location.adresse ? (
                    (() => {
                      const adr: string = gruppe.location.adresse
                      const isUrl = adr.startsWith('http://') || adr.startsWith('https://')
                      const href = isUrl
                        ? adr
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adr)}`
                      return (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-green-400 hover:text-green-300 font-medium transition"
                        >
                          <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {isUrl ? 'In Maps öffnen' : adr}
                        </a>
                      )
                    })()
                  ) : (
                    <p className="text-white font-medium">–</p>
                  )}
                </div>
              </>
            )}
          </div>
          <p className="mt-3 text-xs text-gray-500">Die Gruppe kann nur vom Vorstand oder Admin geändert werden.</p>
        </div>
      ) : (
        <div className="mb-6 rounded-xl border border-white/10 bg-slate-900 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">Meine Gitarrengruppe</h2>
          <p className="text-sm text-gray-400">Noch keiner Gruppe zugewiesen.</p>
        </div>
      )}

      {/* Daten bearbeiten */}
      <form onSubmit={handleSave} className="rounded-xl border border-white/10 bg-slate-900 p-6 flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-white mb-2">Daten bearbeiten</h2>
        {user.username && (
          <div>
            <label className="mb-1 block text-sm text-gray-400">Benutzername</label>
            <input value={user.username} readOnly
              className="w-full rounded-lg border border-white/10 bg-slate-700/50 px-3 py-2 text-gray-300 cursor-not-allowed" />
            <p className="mt-1 text-xs text-gray-500">Der Benutzername kann nicht geändert werden.</p>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm text-gray-400">Vorname</label>
          <input value={vorname} onChange={e => setVorname(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">Nachname</label>
          <input value={nachname} onChange={e => setNachname(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
        </div>
        <button type="submit" disabled={saving}
          className="rounded-lg bg-green-600 py-2.5 font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition">
          {saved ? '✓ Gespeichert' : saving ? 'Speichern…' : 'Speichern'}
        </button>
      </form>
    </div>
  )
}
