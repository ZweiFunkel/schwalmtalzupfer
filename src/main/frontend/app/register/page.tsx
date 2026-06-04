'use client'
import { getApiBase } from '@/lib/api'

import React, { useState, Suspense, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

const API_BASE = getApiBase()

function RegisterForm() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') ?? ''

  const [vorname, setVorname] = useState('')
  const [nachname, setNachname] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [iban, setIban] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/invitation/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, vorname, nachname, username: username || undefined, iban: iban || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: 'Registrierung fehlgeschlagen' }))
        throw new Error(data.message || 'Registrierung fehlgeschlagen')
      }
      setSuccess(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center text-green-400">
        <p className="text-lg font-semibold">✓ Registrierung erfolgreich!</p>
        <p className="text-sm text-gray-400 mt-1">Du wirst zur Login-Seite weitergeleitet…</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm text-gray-400">Einladungs-Token</label>
        <input value={token} readOnly
          className="w-full rounded-lg border border-white/10 bg-slate-700 px-3 py-2 text-gray-400 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
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
      </div>
      <div>
        <label className="mb-1 block text-sm text-gray-400">Username (optional)</label>
        <input value={username} onChange={e => setUsername(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none"
          placeholder="z.B. max.mustermann" />
      </div>
      <div>
        <label className="mb-1 block text-sm text-gray-400">Passwort wählen</label>
        <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none" />
      </div>
      <div>
        <label className="mb-1 block text-sm text-gray-400">IBAN (optional, für Beitragsabbuchung)</label>
        <input type="text" value={iban} onChange={e => setIban(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none"
          placeholder="DE00 0000 0000 0000 0000 00" />
      </div>
      {error && <p className="rounded-lg bg-red-900/30 px-3 py-2 text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={loading}
        className="mt-2 rounded-lg bg-green-600 py-2.5 font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition">
        {loading ? 'Wird gespeichert…' : 'Konto erstellen'}
      </button>
    </form>
  )
}

export default function RegisterPage() {
  useEffect(() => { document.title = 'Registrierung – Schwalmtalzupfer' }, [])
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">𝄞</div>
          <h1 className="text-2xl font-bold text-white">Einladung annehmen</h1>
          <p className="mt-1 text-sm text-gray-400">Erstelle dein Mitgliedskonto</p>
        </div>
        <Suspense fallback={<p className="text-gray-400 text-sm text-center">Laden…</p>}>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  )
}
